'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import apiClient from '@/lib/api/client';
import { Product } from '@/types';
import { productsApi } from '@/lib/api/products';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  items?: AddedItem[];
}

interface AddedItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit?: string;
  reason?: string;
  notes?: string;
  project_site?: string;
}

interface PRItem {
  product_id: number;
  product?: Product;
  quantity: number;
  unit: string;
  reason: string;
  notes: string;
  project_site: string;
}

export interface AIFormUpdate {
  project_id?: number;
  title?: string;
  required_by?: string;
  notes?: string;
}

interface Props {
  onAddItems: (items: PRItem[]) => void;
  onFormUpdate?: (fields: AIFormUpdate) => void;
}

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export default function AIProcurementChat({ onAddItems, onFormUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'مرحباً! أنا مساعدك الذكي للمشتريات.\n\nيمكنك الكتابة أو الضغط على 🎙 للمحادثة الصوتية المباشرة.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Voice conversation state
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [interimText, setInterimText] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTextRef = useRef('');
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, interimText]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Speak via OpenAI TTS (falls back to browser if API fails) ────────
  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!text.trim()) { onDone?.(); return; }

    // Stop any current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();

    apiClient.post('/ai/tts/', { text }, { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended  = () => { URL.revokeObjectURL(url); audioRef.current = null; onDone?.(); };
        audio.onerror  = () => { URL.revokeObjectURL(url); audioRef.current = null; onDone?.(); };
        audio.play().catch(() => { onDone?.(); });
      })
      .catch(() => {
        // Fallback to browser TTS
        if ('speechSynthesis' in window) {
          const u = new SpeechSynthesisUtterance(text);
          u.lang  = /[؀-ۿ]/.test(text) ? 'ar-SA' : 'en-US';
          u.rate  = 0.92;
          u.onend = () => onDone?.();
          window.speechSynthesis.speak(u);
        } else {
          onDone?.();
        }
      });
  }, []);

  // ── Stop voice recognition cleanly ───────────────────────────────────
  const stopRecognition = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setInterimText('');
    pendingTextRef.current = '';
  }, []);

  // ── Send message to AI ────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string, isVoice = false) => {
    if (!text.trim() && !imageFile) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messagesRef.current, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    if (isVoice) setVoiceState('thinking');

    try {
      const history = newMessages.map((m) => ({ role: m.role, content: m.content }));
      const fd = new FormData();
      fd.append('messages', JSON.stringify(history));
      if (imageFile) {
        fd.append('image', imageFile);
        setImageFile(null);
        setImagePreview(null);
      }

      const res = await apiClient.post('/ai/chat/', fd);
      const { reply, tool_use, spoken_reply } = res.data;

      // Handle form fields
      if (tool_use?.form && onFormUpdate) {
        const formFields: AIFormUpdate = {};
        if (tool_use.form.project_id)  formFields.project_id  = tool_use.form.project_id;
        if (tool_use.form.title)       formFields.title       = tool_use.form.title;
        if (tool_use.form.required_by) formFields.required_by = tool_use.form.required_by;
        if (tool_use.form.notes)       formFields.notes       = tool_use.form.notes;
        if (Object.keys(formFields).length) onFormUpdate(formFields);
      }

      // Handle product items
      let addedItems: AddedItem[] = [];
      if (tool_use?.items?.length) {
        addedItems = tool_use.items;
        const prItems: PRItem[] = [];
        for (const item of tool_use.items) {
          try {
            const product = await productsApi.getById(item.product_id);
            prItems.push({ product_id: item.product_id, product, quantity: item.quantity, unit: item.unit || product.unit || '', reason: item.reason || '', notes: item.notes || '', project_site: item.project_site || '' });
          } catch {
            prItems.push({ product_id: item.product_id, quantity: item.quantity, unit: item.unit || '', reason: item.reason || '', notes: item.notes || '', project_site: item.project_site || '' });
          }
        }
        onAddItems(prItems);
      }

      const assistantText = tool_use?.message || reply || '✓ تم';
      setMessages((prev) => [...prev, { role: 'assistant', content: assistantText, items: addedItems.length ? addedItems : undefined }]);

      // Voice mode: speak clean version then resume listening
      if (isVoice) {
        setVoiceState('speaking');
        speak(spoken_reply || assistantText, () => {
          setVoiceState('listening');
          startListening(true);
        });
      }
    } catch (err: any) {
      const serverError = err?.response?.data?.error;
      const errMsg = serverError ? `❌ ${serverError}` : '❌ حدث خطأ في الاتصال، حاول مرة أخرى.';
      setMessages((prev) => [...prev, { role: 'assistant', content: errMsg }]);
      if (isVoice) {
        setVoiceState('listening');
        startListening(true);
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFile, onAddItems, onFormUpdate, speak]);

  // ── Start continuous voice recognition ───────────────────────────────
  const startListening = useCallback((resume = false) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('متصفحك لا يدعم التعرف على الصوت. استخدم Chrome.'); return; }

    stopRecognition();
    if (!resume) setVoiceState('listening');

    const rec = new SR();
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.lang            = 'ar-SA';
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onresult = (e: any) => {
      // Barge-in: stop AI speech the moment user starts talking
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
        window.speechSynthesis?.cancel();
        setVoiceState('listening');
      }

      let interim = '';
      let finalChunk = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalChunk += t;
        else interim += t;
      }
      setInterimText(interim);
      if (finalChunk) {
        pendingTextRef.current += finalChunk + ' ';
        setInterimText('');
        // Reset silence timer
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const text = pendingTextRef.current.trim();
          if (text) {
            pendingTextRef.current = '';
            stopRecognition();
            setVoiceState('thinking');
            sendMessage(text, true);
          }
        }, 900);
      }
    };

    rec.onerror = (e: any) => {
      if (e.error === 'no-speech') return; // ignore, just keep going
      if (e.error !== 'aborted') setVoiceState('idle');
    };

    rec.onend = () => {
      // Auto-restart if still in listening state (browser sometimes stops)
      if (voiceState === 'listening' && recognitionRef.current === rec) {
        try { rec.start(); } catch {}
      }
    };

    try { rec.start(); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopRecognition, sendMessage]);

  // ── Toggle voice conversation mode ───────────────────────────────────
  const toggleVoice = useCallback(() => {
    if (voiceState !== 'idle') {
      window.speechSynthesis?.cancel();
      stopRecognition();
      setVoiceState('idle');
    } else {
      startListening();
    }
  }, [voiceState, stopRecognition, startListening]);

  // Cleanup on unmount
  useEffect(() => () => {
    stopRecognition();
    window.speechSynthesis?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  }, [stopRecognition]);

  // ── Text send ─────────────────────────────────────────────────────────
  const send = useCallback(() => sendMessage(input), [sendMessage, input]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleImage = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image'));
    if (item) { const f = item.getAsFile(); if (f) handleImage(f); }
  };

  // ── Voice state UI helpers ────────────────────────────────────────────
  const voiceLabel: Record<VoiceState, string> = {
    idle:      'محادثة صوتية',
    listening: 'يسمع… تكلم',
    thinking:  'يفكر…',
    speaking:  'يتكلم…',
  };
  const voiceColor: Record<VoiceState, string> = {
    idle:      '#6b7280',
    listening: '#22c55e',
    thinking:  '#f97316',
    speaking:  '#3b82f6',
  };

  // ── Collapsed button ──────────────────────────────────────────────────
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
        borderRadius: 8, background: '#fff',
        color: '#1a1a2e', border: '1.5px solid #e2e8f0', cursor: 'pointer',
        fontSize: 12, fontWeight: 600,
        boxShadow: '0 1px 6px rgba(0,0,0,0.08)', transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.boxShadow = '0 4px 16px rgba(249,115,22,0.18)';
          el.style.borderColor = '#f97316';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.boxShadow = '0 1px 6px rgba(0,0,0,0.08)';
          el.style.borderColor = '#e2e8f0';
        }}
      >
        <Image src="/logo.svg" alt="ERB" width={22} height={22} style={{ flexShrink: 0 }} unoptimized />
        <span style={{ color: '#f97316', fontWeight: 700 }}>AI</span>
        <span style={{ color: '#64748b' }}>Assistant</span>
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      width: 420, height: 600,
      background: 'var(--card-bg)', border: '1px solid var(--border-primary)',
      borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        background: '#1a1a2e', color: '#fff',
        borderBottom: '2px solid #f97316',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image src="/logo.svg" alt="ERB" width={32} height={32} style={{ flexShrink: 0 }} unoptimized />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: '.2px' }}>
              <span style={{ color: '#f97316' }}>AI</span> Procurement Assistant
            </div>
            <div style={{ fontSize: 10, opacity: 0.6, marginTop: 1 }}>Claude · عربي / English</div>
          </div>
        </div>
        <button type="button" onClick={() => { stopRecognition(); window.speechSynthesis?.cancel(); setOpen(false); }}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 20, lineHeight: 1, opacity: 0.7 }}>×</button>
      </div>

      {/* Voice mode banner */}
      {voiceState !== 'idle' && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '10px 16px', background: voiceColor[voiceState] + '18',
          borderBottom: `2px solid ${voiceColor[voiceState]}`,
        }}>
          {/* Animated rings */}
          <div style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
            {voiceState === 'listening' && [0, 1, 2].map((i) => (
              <div key={i} style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: `2px solid ${voiceColor.listening}`,
                animation: `ripple 1.8s ease-out ${i * 0.6}s infinite`,
              }} />
            ))}
            <div style={{
              position: 'absolute', inset: 4, borderRadius: '50%',
              background: voiceColor[voiceState],
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12,
            }}>
              {voiceState === 'listening' ? '🎙' : voiceState === 'speaking' ? '🔊' : '⏳'}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: voiceColor[voiceState] }}>{voiceLabel[voiceState]}</div>
            {interimText && <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>{interimText}</div>}
          </div>
          <button type="button" onClick={toggleVoice} style={{
            marginLeft: 'auto', padding: '4px 10px', borderRadius: 8,
            background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12,
          }}>إيقاف</button>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '88%', padding: '8px 12px', borderRadius: 12,
              background: m.role === 'user' ? 'linear-gradient(135deg,#f97316,#ea580c)' : 'var(--bg-secondary)',
              color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
              fontSize: 13, lineHeight: 1.5,
              borderBottomRightRadius: m.role === 'user' ? 4 : 12,
              borderBottomLeftRadius: m.role === 'assistant' ? 4 : 12,
              whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>
            {m.items && m.items.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, width: '88%' }}>
                {m.items.map((it, j) => (
                  <div key={j} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' }}>
                    ✓ <strong>{it.product_name}</strong> × {it.quantity} {it.unit || ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#f97316', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>جاري التفكير…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div style={{ padding: '0 14px 8px', position: 'relative', display: 'inline-block' }}>
          <img src={imagePreview} alt="preview" style={{ maxHeight: 80, borderRadius: 8, border: '1px solid var(--border-primary)' }} />
          <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
            style={{ position: 'absolute', top: -4, right: 10, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
      )}

      {/* Input area */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-primary)', display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        {/* Image */}
        <button type="button" onClick={() => fileInputRef.current?.click()} title="أرسل صورة"
          style={{ flexShrink: 0, padding: 7, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)' }}>📎</button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); e.target.value = ''; }} />

        {/* Text */}
        <textarea ref={textareaRef} rows={1} value={input}
          onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey} onPaste={handlePaste}
          placeholder={voiceState !== 'idle' ? 'تكلم أو اكتب…' : 'اكتب احتياجاتك…'}
          style={{
            flex: 1, resize: 'none', border: '1px solid var(--border-primary)',
            borderRadius: 8, padding: '7px 10px', fontSize: 13,
            background: 'var(--input-bg)', color: 'var(--text-primary)',
            outline: 'none', maxHeight: 80, overflowY: 'auto', fontFamily: 'inherit', lineHeight: 1.4,
          }} />

        {/* Voice conversation button */}
        <button type="button" onClick={toggleVoice} title="محادثة صوتية"
          style={{
            flexShrink: 0, padding: 7, borderRadius: 8, cursor: 'pointer', fontSize: 16,
            background: voiceState !== 'idle' ? voiceColor[voiceState] + '22' : 'var(--bg-secondary)',
            border: `2px solid ${voiceState !== 'idle' ? voiceColor[voiceState] : 'var(--border-primary)'}`,
            color: voiceState !== 'idle' ? voiceColor[voiceState] : 'var(--text-secondary)',
            transition: 'all 0.2s',
          }}>
          🎙
        </button>

        {/* Send */}
        <button type="button" onClick={send} disabled={loading || (!input.trim() && !imageFile)}
          style={{
            flexShrink: 0, padding: '7px 14px', borderRadius: 8,
            background: loading || (!input.trim() && !imageFile) ? 'var(--bg-tertiary)' : 'linear-gradient(135deg,#f97316,#ea580c)',
            color: loading || (!input.trim() && !imageFile) ? 'var(--text-secondary)' : '#fff',
            border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700,
          }}>↑</button>
      </div>

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes ripple { 0%{transform:scale(1);opacity:1} 100%{transform:scale(2.5);opacity:0} }
      `}</style>
    </div>
  );
}
