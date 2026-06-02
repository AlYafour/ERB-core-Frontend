'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import apiClient from '@/lib/api/client';
import { productsApi } from '@/lib/api/products';
import type { AIFormUpdate } from './AIProcurementChat';
import type { Product } from '@/types';

interface PRItem {
  product_id: number;
  product?: Product;
  quantity: number;
  unit: string;
  reason: string;
  notes: string;
  project_site: string;
}

interface TranscriptEntry {
  id: number;
  role: 'user' | 'assistant';
  text: string;
}

type Status = 'idle' | 'connecting' | 'connected' | 'error';

interface Props {
  onAddItems: (items: PRItem[]) => void;
  onFormUpdate?: (fields: AIFormUpdate) => void;
}

export default function VoiceRealtimeChat({ onAddItems, onFormUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [statusText, setStatusText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const idRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const addTranscript = useCallback((role: 'user' | 'assistant', text: string) => {
    if (!text.trim()) return;
    setTranscript(prev => [...prev, { id: ++idRef.current, role, text }]);
  }, []);

  const resolveItems = useCallback(async (items: any[]): Promise<PRItem[]> => {
    const result: PRItem[] = [];
    for (const item of items) {
      try {
        const product = await productsApi.getById(item.product_id);
        result.push({
          product_id: item.product_id, product,
          quantity: item.quantity,
          unit: item.unit || product.unit || '',
          reason: item.reason || '',
          notes: item.notes || '',
          project_site: item.project_site || '',
        });
      } catch {
        result.push({
          product_id: item.product_id,
          quantity: item.quantity,
          unit: item.unit || '',
          reason: item.reason || '',
          notes: item.notes || '',
          project_site: item.project_site || '',
        });
      }
    }
    return result;
  }, []);

  const handleToolCall = useCallback(async (event: any) => {
    const { call_id, name, arguments: argsStr } = event;
    let args: any = {};
    try { args = JSON.parse(argsStr); } catch {}

    if (name === 'fill_purchase_request') {
      if (args.form && onFormUpdate) {
        const fields: AIFormUpdate = {};
        if (args.form.project_id)  fields.project_id  = args.form.project_id;
        if (args.form.title)       fields.title       = args.form.title;
        if (args.form.required_by) fields.required_by = args.form.required_by;
        if (args.form.notes)       fields.notes       = args.form.notes;
        if (Object.keys(fields).length) onFormUpdate(fields);
      }
      if (args.items?.length) {
        resolveItems(args.items).then(prItems => onAddItems(prItems));
      }
      // Return result so AI speaks the confirmation
      dcRef.current?.send(JSON.stringify({
        type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id, output: JSON.stringify({ success: true }) },
      }));
      dcRef.current?.send(JSON.stringify({ type: 'response.create' }));
    }
  }, [onFormUpdate, onAddItems, resolveItems]);

  const handleEvent = useCallback((event: any) => {
    switch (event.type) {
      case 'session.created':
      case 'session.updated':
        setStatus('connected');
        setStatusText('متصل — تكلم');
        break;
      case 'input_audio_buffer.speech_started':
        setUserSpeaking(true);
        setStatusText('يسمعك…');
        break;
      case 'input_audio_buffer.speech_stopped':
        setUserSpeaking(false);
        setStatusText('يفكر…');
        break;
      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) addTranscript('user', event.transcript);
        break;
      case 'response.created':
        setStatusText('يفكر…');
        break;
      case 'response.audio.delta':
        setAiSpeaking(true);
        setStatusText('يتكلم…');
        break;
      case 'response.audio_transcript.done':
        if (event.transcript) addTranscript('assistant', event.transcript);
        break;
      case 'response.done':
        setAiSpeaking(false);
        setStatusText('متصل — تكلم');
        break;
      case 'response.function_call_arguments.done':
        handleToolCall(event);
        break;
      case 'error':
        setErrorMsg(event.error?.message || 'خطأ غير معروف');
        break;
    }
  }, [addTranscript, handleToolCall]);

  const stopVoice = useCallback(() => {
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    try { dcRef.current?.close(); } catch {}
    dcRef.current = null;
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    if (audioElRef.current) audioElRef.current.srcObject = null;
    setStatus('idle');
    setAiSpeaking(false);
    setUserSpeaking(false);
    setStatusText('');
  }, []);

  const startVoice = useCallback(async () => {
    setStatus('connecting');
    setStatusText('جاري الاتصال…');
    setErrorMsg('');
    try {
      const { data } = await apiClient.post('/ai/realtime-session/');
      const ephemeralKey = data.client_secret.value;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      if (!audioElRef.current) audioElRef.current = new Audio();
      audioElRef.current.autoplay = true;
      pc.ontrack = (e) => { if (audioElRef.current) audioElRef.current.srcObject = e.streams[0]; };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onmessage = (e) => handleEvent(JSON.parse(e.data));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
        {
          method: 'POST',
          body: offer.sdp,
          headers: { Authorization: `Bearer ${ephemeralKey}`, 'Content-Type': 'application/sdp' },
        }
      );
      if (!sdpRes.ok) throw new Error(`OpenAI: ${sdpRes.status}`);
      await pc.setRemoteDescription({ type: 'answer', sdp: await sdpRes.text() });

    } catch (err: any) {
      setStatus('error');
      setStatusText('');
      setErrorMsg(err.message || 'فشل الاتصال');
      stopVoice();
    }
  }, [handleEvent, stopVoice]);

  useEffect(() => () => stopVoice(), [stopVoice]);

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const ringColor = userSpeaking ? '#22c55e' : aiSpeaking ? '#8b5cf6' : '#6b7280';
  const centerIcon = isConnecting ? '⏳' : aiSpeaking ? '🔊' : '🎙';

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            background: '#fff',
            color: '#1a1a2e', border: '1.5px solid #e2e8f0', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            boxShadow: '0 1px 6px rgba(0,0,0,0.08)', transition: 'box-shadow 0.2s, border-color 0.2s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.boxShadow = '0 4px 16px rgba(139,92,246,0.18)';
            el.style.borderColor = '#8b5cf6';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.boxShadow = '0 1px 6px rgba(0,0,0,0.08)';
            el.style.borderColor = '#e2e8f0';
          }}
        >
          <Image src="/logo.svg" alt="ERB" width={22} height={22} style={{ flexShrink: 0 }} unoptimized />
          <span style={{ color: '#8b5cf6', fontWeight: 700 }}>Voice</span>
          <span style={{ color: '#64748b' }}>AI</span>
        </button>
      )}

      {open && (
        <div style={{
          position: 'fixed', bottom: 24, left: 24, zIndex: 9998,
          width: 340, height: 520,
          background: 'var(--card-bg)', border: '1px solid var(--border-primary)',
          borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            padding: '10px 14px',
            background: '#1a1a2e', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0, borderBottom: '2px solid #8b5cf6',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Image src="/logo.svg" alt="ERB" width={32} height={32} style={{ flexShrink: 0 }} unoptimized />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: '.2px' }}>
                  <span style={{ color: '#8b5cf6' }}>Voice</span> AI Assistant
                </div>
                <div style={{ fontSize: 10, opacity: 0.6, marginTop: 1 }}>GPT-4o Realtime · عربي / English</div>
              </div>
            </div>
            <button type="button" onClick={() => { stopVoice(); setOpen(false); }}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0, opacity: 0.7 }}>×</button>
          </div>

          {/* Visualization panel */}
          <div style={{
            padding: '16px 16px 12px', flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            borderBottom: '1px solid var(--border-primary)',
          }}>
            {/* Animated orb */}
            <div style={{ position: 'relative', width: 80, height: 80 }}>
              {(aiSpeaking || userSpeaking) && [0, 1, 2].map((i) => (
                <div key={i} style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: `2px solid ${ringColor}`,
                  animation: `vripple 1.8s ease-out ${i * 0.55}s infinite`,
                  opacity: 0,
                }} />
              ))}
              <div style={{
                position: 'absolute', inset: 10, borderRadius: '50%',
                background: isConnected ? ringColor : '#374151',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, transition: 'background 0.3s',
                boxShadow: isConnected ? `0 0 24px ${ringColor}55` : 'none',
              }}>
                {centerIcon}
              </div>
            </div>

            {/* Status text */}
            <div style={{ textAlign: 'center', minHeight: 32 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: isConnected ? ringColor : 'var(--text-secondary)' }}>
                {statusText || (isConnected ? 'متصل — تكلم' : 'اضغط ابدأ')}
              </div>
              {errorMsg && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{errorMsg}</div>}
            </div>

            {/* Action button */}
            {isConnecting ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
                جاري الاتصال
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#8b5cf6', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
                ))}
              </div>
            ) : isConnected ? (
              <button type="button" onClick={stopVoice} style={{
                padding: '7px 28px', borderRadius: 20,
                background: '#ef4444', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              }}>إنهاء</button>
            ) : (
              <button type="button" onClick={startVoice} style={{
                padding: '7px 28px', borderRadius: 20,
                background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
                color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              }}>ابدأ المحادثة</button>
            )}
          </div>

          {/* Transcript */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {transcript.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, marginTop: 20, lineHeight: 1.8 }}>
                ابدأ المحادثة وتكلم بشكل طبيعي<br />سيظهر النص هنا تلقائياً
              </div>
            ) : transcript.map((t) => (
              <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: t.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '86%', padding: '6px 10px', borderRadius: 10,
                  fontSize: 12, lineHeight: 1.55,
                  background: t.role === 'user' ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)' : 'var(--bg-secondary)',
                  color: t.role === 'user' ? '#fff' : 'var(--text-primary)',
                  borderBottomRightRadius: t.role === 'user' ? 3 : 10,
                  borderBottomLeftRadius: t.role === 'assistant' ? 3 : 10,
                  whiteSpace: 'pre-wrap',
                }}>
                  {t.text}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes vripple { 0%{transform:scale(1);opacity:0.7} 100%{transform:scale(2.7);opacity:0} }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
      `}</style>
    </>
  );
}
