'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useTenantInfo } from '@/lib/hooks/use-tenant';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallRecord[];
  isStreaming?: boolean;
}

interface ToolCallRecord {
  name: string;
  summary?: string;
  status: 'running' | 'done';
}

const TOOL_LABELS: Record<string, string> = {
  search_products:         'Searching products…',
  get_projects:            'Loading projects…',
  get_suppliers:           'Loading suppliers…',
  get_pending_approvals:   'Checking approvals…',
  get_records:             'Fetching records…',
  navigate_to:             'Navigating…',
  create_purchase_request: 'Creating PR…',
};

const STORAGE_KEY = 'aria_chat_history';

/* ── Colors ─────────────────────────────────────────────────────────────────── */
const C = {
  gold:     '#C9943A',
  goldHov:  '#A07228',
  goldDark: '#E0AE55',
  red:      '#E05C5C',
  ground:   '#07101F',
  surf:     '#0F1D30',
  surf2:    '#152640',
  border:   '#1A2C42',
  border2:  '#243650',
  text:     '#E2EAF4',
  text2:    '#9AB0C8',
  text3:    '#4A6280',
};

type SpeechRecognitionType = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (e: SpeechRecognitionEvent) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionEvent = { results: { [k: number]: { [k: number]: { transcript: string } } } };

function getSpeechRecognition(): (new () => SpeechRecognitionType) | null {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function BlinkCursor() {
  return <span style={{ display: 'inline-block', width: 2, height: 12, background: C.gold, marginLeft: 2, verticalAlign: 'text-bottom', animation: 'aria-blink 1s step-end infinite' }} />;
}

export default function GlobalAIAssistant() {
  const [isOpen, setIsOpen]       = useState(false);
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [input, setInput]         = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [liveTools, setLiveTools] = useState<ToolCallRecord[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [hasSR, setHasSR] = useState(false);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const abortRef   = useRef<AbortController | null>(null);
  const srRef      = useRef<SpeechRecognitionType | null>(null);

  const pathname = usePathname();
  const router   = useRouter();
  const { accessToken } = useAuthStore();
  const { data: tenantData } = useTenantInfo();
  const companyName = tenantData?.branding?.company_legal_name || tenantData?.name || undefined;

  useEffect(() => {
    setHasSR(!!getSpeechRecognition());
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) setMessages(JSON.parse(raw)); } catch {}
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-60))); } catch {}
  }, [messages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, liveTools]);
  useEffect(() => { if (isOpen) setTimeout(() => inputRef.current?.focus(), 260); }, [isOpen]);

  const toggleVoice = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) return alert('Voice input is not supported in this browser.');
    if (isListening) { srRef.current?.stop(); setIsListening(false); return; }
    const sr = new SR();
    srRef.current = sr;
    sr.lang = 'ar-AE';
    sr.continuous = false;
    sr.interimResults = false;
    sr.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => (prev ? prev + ' ' + transcript : transcript));
    };
    sr.onerror = () => setIsListening(false);
    sr.onend   = () => setIsListening(false);
    sr.start();
    setIsListening(true);
  }, [isListening]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading || !accessToken) return;
    setInput('');
    setIsLoading(true);
    setLiveTools([]);
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    const asstMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', isStreaming: true };
    setMessages(prev => [...prev, userMsg, asstMsg]);
    const apiMessages = [
      ...messages.map(m => ({ role: m.role, content: m.content || '…' })),
      { role: 'user' as const, content: text },
    ];
    try {
      abortRef.current = new AbortController();
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, authToken: `Bearer ${accessToken}`, currentPage: pathname, companyName }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '', accText = '', toolList: ToolCallRecord[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.t === 'text') {
              accText += ev.v;
              setMessages(prev => prev.map(m => m.id === asstMsg.id ? { ...m, content: accText } : m));
            } else if (ev.t === 'tool_start') {
              toolList = [...toolList, { name: ev.name, status: 'running' }];
              setLiveTools([...toolList]);
            } else if (ev.t === 'tool_done') {
              toolList = toolList.map(tc => tc.name === ev.name ? { ...tc, status: 'done', summary: ev.summary } : tc);
              setLiveTools([...toolList]);
            } else if (ev.t === 'nav') {
              router.push(ev.path);
            } else if (ev.t === 'done') {
              setMessages(prev => prev.map(m => m.id === asstMsg.id ? { ...m, isStreaming: false, toolCalls: toolList } : m));
              setLiveTools([]);
              setIsLoading(false);
            } else if (ev.t === 'error') {
              setMessages(prev => prev.map(m => m.id === asstMsg.id ? { ...m, content: `Error: ${ev.msg}`, isStreaming: false } : m));
              setIsLoading(false);
            }
          } catch {}
        }
      }
    } catch (e: unknown) {
      if ((e as Error)?.name === 'AbortError') return;
      setMessages(prev => prev.map(m => m.id === asstMsg.id ? { ...m, content: 'Connection error — please try again.', isStreaming: false } : m));
      setIsLoading(false);
      setLiveTools([]);
    }
  }, [input, isLoading, accessToken, messages, pathname, router]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearHistory = () => {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return (
    <>
      <style>{`
        @keyframes aria-blink  { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes aria-spin   { to{transform:rotate(360deg)} }
        @keyframes aria-pop    { 0%{opacity:0;transform:scale(0.92) translateY(12px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes aria-pulse  { 0%,100%{box-shadow:0 0 0 0 rgba(201,148,58,0.5)} 70%{box-shadow:0 0 0 10px rgba(201,148,58,0)} }
        @keyframes aria-dot    { 0%,100%{opacity:1} 50%{opacity:0.35} }
      `}</style>

      {/* ── FAB ── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        aria-label="Open ARIA assistant"
        style={{
          position: 'fixed', bottom: 24, right: 24,
          width: 52, height: 52, borderRadius: '50%',
          background: isOpen
            ? C.surf2
            : `linear-gradient(135deg, ${C.gold} 0%, ${C.goldHov} 100%)`,
          color: '#fff', border: `1.5px solid ${isOpen ? C.border : 'transparent'}`,
          cursor: 'pointer',
          boxShadow: isOpen
            ? `0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px ${C.border}`
            : `0 4px 24px rgba(201,148,58,0.45), 0 2px 8px rgba(0,0,0,0.3)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9001,
          transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
          animation: !isOpen ? 'aria-pulse 3s ease-out infinite' : 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {isOpen
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-8v4h4l-5 8z"/></svg>
        }
      </button>

      {/* ── Chat popup ── */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: 88, right: 20,
          width: 380, maxWidth: 'calc(100vw - 32px)',
          height: 540, maxHeight: 'calc(100vh - 120px)',
          background: C.surf,
          border: `1px solid ${C.border}`,
          borderRadius: 18,
          boxShadow: `0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,148,58,0.08)`,
          zIndex: 9000,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'aria-pop 0.24s cubic-bezier(0.34,1.56,0.64,1)',
        }}>

          {/* Gold accent line */}
          <div style={{ height: 2, background: `linear-gradient(90deg, ${C.gold}, ${C.goldHov}, transparent)`, flexShrink: 0 }} />

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 14px',
            background: C.surf2,
            borderBottom: `1px solid ${C.border}`,
            flexShrink: 0,
          }}>
            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: `linear-gradient(135deg, ${C.gold}, ${C.goldHov})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, border: `1.5px solid rgba(201,148,58,0.3)`,
              boxShadow: `0 2px 8px rgba(201,148,58,0.2)`,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-8v4h4l-5 8z"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text, lineHeight: 1.2 }}>ARIA</div>
              <div style={{ fontSize: 10, color: C.text3, marginTop: 1 }}>ERB Intelligent Assistant</div>
            </div>
            {/* Online indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(201,148,58,0.08)', border: `1px solid rgba(201,148,58,0.15)`,
              borderRadius: 20, padding: '3px 8px',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.gold, animation: 'aria-dot 2s ease-in-out infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: C.goldDark, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Online</span>
            </div>
            {/* Clear */}
            <button
              onClick={clearHistory}
              title="Clear conversation"
              style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text3, cursor: 'pointer', padding: '5px 6px', borderRadius: 8, display: 'flex', alignItems: 'center', marginLeft: 2, transition: 'all 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = C.text; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = C.text3; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px 8px', display: 'flex', flexDirection: 'column', gap: 8, background: C.ground }}>

            {/* Empty state */}
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '28px 20px 16px', color: C.text3 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${C.gold}, ${C.goldHov})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px', boxShadow: `0 4px 16px rgba(201,148,58,0.3)`,
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-8v4h4l-5 8z"/></svg>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 6 }}>Hi, I&apos;m ARIA</div>
                <div style={{ fontSize: 12, lineHeight: 1.7, maxWidth: 280, margin: '0 auto', color: C.text2 }}>
                  Ask me about purchase requests, suppliers, projects, or pending approvals.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 18 }}>
                  {['Show pending approvals', 'How many active projects?', 'Search for cement products'].map(q => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }}
                      style={{
                        background: C.surf2, border: `1px solid ${C.border}`,
                        borderRadius: 10, padding: '7px 12px',
                        fontSize: 12, color: C.text2, cursor: 'pointer', textAlign: 'left',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.goldDark; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text2; }}
                    >
                      {q} →
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map(msg => (
              <div key={msg.id}>
                {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 5 }}>
                    {msg.toolCalls.map((tc, i) => (
                      <span key={i} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 8px',
                        background: 'rgba(201,148,58,0.08)', border: `1px solid rgba(201,148,58,0.2)`,
                        borderRadius: 20, fontSize: 11, color: C.goldDark,
                      }}>
                        <span>✓</span>{TOOL_LABELS[tc.name]?.replace('…', '') || tc.name}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 6 }}>
                  {msg.role === 'assistant' && (
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${C.gold}, ${C.goldHov})`,
                      flexShrink: 0, marginBottom: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-8v4h4l-5 8z"/></svg>
                    </div>
                  )}
                  <div style={{
                    maxWidth: '82%',
                    padding: msg.role === 'user' ? '8px 13px' : '9px 13px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                    background: msg.role === 'user'
                      ? `linear-gradient(135deg, ${C.gold} 0%, ${C.goldHov} 100%)`
                      : C.surf2,
                    border: msg.role === 'user' ? 'none' : `1px solid ${C.border}`,
                    color: msg.role === 'user' ? '#fff' : C.text,
                    fontSize: 13, lineHeight: 1.6,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    boxShadow: msg.role === 'user' ? `0 2px 10px rgba(201,148,58,0.3)` : `0 1px 3px rgba(0,0,0,0.2)`,
                  }}>
                    {msg.content || (msg.isStreaming ? <BlinkCursor /> : '…')}
                    {msg.isStreaming && msg.content && <BlinkCursor />}
                  </div>
                </div>
              </div>
            ))}

            {/* Live tool indicators */}
            {liveTools.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingLeft: 28 }}>
                {liveTools.map((tc, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 9px',
                    background: tc.status === 'done' ? 'rgba(201,148,58,0.08)' : 'rgba(201,148,58,0.04)',
                    border: `1px solid ${tc.status === 'done' ? 'rgba(201,148,58,0.25)' : 'rgba(201,148,58,0.15)'}`,
                    borderRadius: 20, fontSize: 11,
                    color: tc.status === 'done' ? C.goldDark : C.text3,
                  }}>
                    {tc.status === 'running'
                      ? <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', border: `1.5px solid ${C.gold}`, borderTopColor: 'transparent', animation: 'aria-spin 0.7s linear infinite' }} />
                      : <span style={{ color: C.gold }}>✓</span>
                    }
                    {TOOL_LABELS[tc.name] || tc.name}
                  </span>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div style={{ padding: '10px 12px 12px', borderTop: `1px solid ${C.border}`, flexShrink: 0, background: C.surf }}>
            <div style={{
              display: 'flex', gap: 6, alignItems: 'flex-end',
              background: C.surf2, border: `1.5px solid ${C.border}`,
              borderRadius: 14, padding: '7px 8px 7px 13px',
              transition: 'border-color 0.15s',
            }}
            onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = C.gold; }}
            onBlurCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask ARIA anything…"
                disabled={isLoading}
                rows={1}
                style={{
                  flex: 1, border: 'none', background: 'transparent',
                  resize: 'none', outline: 'none',
                  fontSize: 13, lineHeight: 1.5,
                  maxHeight: 96, overflowY: 'auto',
                  color: C.text,
                }}
                onInput={e => {
                  const t = e.currentTarget;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 96) + 'px';
                }}
              />

              {hasSR && (
                <button
                  onClick={toggleVoice}
                  title={isListening ? 'Stop listening' : 'Speak'}
                  style={{
                    width: 30, height: 30, borderRadius: '50%', border: 'none',
                    background: isListening ? 'rgba(224,92,92,0.15)' : 'transparent',
                    color: isListening ? C.red : C.text3,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'all 0.15s',
                  }}
                >
                  {isListening
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/></svg>
                  }
                </button>
              )}

              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                style={{
                  width: 30, height: 30, borderRadius: '50%', border: 'none',
                  background: input.trim() && !isLoading
                    ? `linear-gradient(135deg, ${C.gold}, ${C.goldHov})`
                    : C.border,
                  color: input.trim() && !isLoading ? '#fff' : C.text3,
                  cursor: input.trim() && !isLoading ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.15s',
                  boxShadow: input.trim() && !isLoading ? `0 2px 8px rgba(201,148,58,0.4)` : 'none',
                }}
              >
                {isLoading
                  ? <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: `1.5px solid ${C.gold}`, borderTopColor: 'transparent', animation: 'aria-spin 0.7s linear infinite' }} />
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                }
              </button>
            </div>
            <div style={{ fontSize: 10, color: C.text3, marginTop: 5, textAlign: 'center', letterSpacing: 0.2 }}>
              Enter to send · Shift+Enter for new line{hasSR ? ' · 🎤 Voice' : ''}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
