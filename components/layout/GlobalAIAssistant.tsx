'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';

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
  search_products:          'Searching products',
  get_projects:             'Loading projects',
  get_suppliers:            'Loading suppliers',
  get_pending_approvals:    'Checking approvals',
  get_records:              'Fetching records',
  navigate_to:              'Navigating',
  create_purchase_request:  'Creating purchase request',
};

const STORAGE_KEY = 'aria_chat_history';

function BlinkCursor() {
  return (
    <span style={{
      display: 'inline-block',
      width: 2,
      height: 13,
      background: 'currentColor',
      marginLeft: 2,
      verticalAlign: 'text-bottom',
      animation: 'aria-blink 1s step-end infinite',
    }} />
  );
}

export default function GlobalAIAssistant() {
  const [isOpen, setIsOpen]     = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [liveTools, setLiveTools] = useState<ToolCallRecord[]>([]);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const abortRef   = useRef<AbortController | null>(null);

  const pathname = usePathname();
  const router   = useRouter();
  const { accessToken } = useAuthStore();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-60))); } catch {}
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveTools]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 280);
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading || !accessToken) return;

    setInput('');
    setIsLoading(true);
    setLiveTools([]);

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    const asstMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', isStreaming: true };
    setMessages(prev => [...prev, userMsg, asstMsg]);

    // Build history for the API (simple text turns)
    const apiMessages = [
      ...messages.map(m => ({ role: m.role, content: m.content || '…' })),
      { role: 'user' as const, content: text },
    ];

    try {
      abortRef.current = new AbortController();

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, authToken: `Bearer ${accessToken}`, currentPage: pathname }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';
      let accText   = '';
      let toolList: ToolCallRecord[] = [];

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
              setMessages(prev => prev.map(m =>
                m.id === asstMsg.id ? { ...m, isStreaming: false, toolCalls: toolList } : m
              ));
              setLiveTools([]);
              setIsLoading(false);
            } else if (ev.t === 'error') {
              setMessages(prev => prev.map(m =>
                m.id === asstMsg.id ? { ...m, content: `Error: ${ev.msg}`, isStreaming: false } : m
              ));
              setIsLoading(false);
            }
          } catch {}
        }
      }
    } catch (e: unknown) {
      if ((e as Error)?.name === 'AbortError') return;
      setMessages(prev => prev.map(m =>
        m.id === asstMsg.id ? { ...m, content: 'Connection error — please try again.', isStreaming: false } : m
      ));
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
      {/* Blink keyframe injected once */}
      <style>{`@keyframes aria-blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>

      {/* FAB */}
      <button
        onClick={() => setIsOpen(o => !o)}
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          width: 54,
          height: 54,
          borderRadius: '50%',
          background: 'linear-gradient(135deg,#7c2d3e 0%,#4c1a26 100%)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.28)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9001,
          transition: 'transform 0.18s,box-shadow 0.18s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.35)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.28)'; }}
        title="ARIA — AI Assistant"
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-8v4h4l-5 8z" fill="currentColor"/></svg>
        )}
      </button>

      {/* Slide-in panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 420,
        maxWidth: '100vw',
        background: '#fff',
        boxShadow: '-6px 0 40px rgba(0,0,0,0.14)',
        zIndex: 9000,
        display: 'flex',
        flexDirection: 'column',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        borderLeft: '1px solid #e2e8f0',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          background: 'linear-gradient(135deg,#7c2d3e 0%,#4c1a26 100%)',
          color: '#fff',
          flexShrink: 0,
          userSelect: 'none',
        }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-8v4h4l-5 8z" fill="currentColor"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.3 }}>ARIA</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>Al Yafour Intelligent Assistant</div>
          </div>
          <button
            onClick={clearHistory}
            title="Clear conversation"
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.65)', cursor: 'pointer', padding: '5px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: 48, padding: '0 24px' }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>⚡</div>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#475569', marginBottom: 6 }}>Hi, I'm ARIA</div>
              <div style={{ fontSize: 13, lineHeight: 1.65, color: '#64748b' }}>
                Ask me about purchase requests, suppliers, projects, or pending approvals. I can also create records and navigate the system for you.
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id}>
              {/* Completed tool calls shown above assistant bubble */}
              {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
                  {msg.toolCalls.map((tc, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 11.5, color: '#64748b' }}>
                      <span style={{ color: '#22c55e', fontWeight: 700 }}>✓</span>
                      <span>{TOOL_LABELS[tc.name] || tc.name}</span>
                      {tc.summary && <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 11 }}>{tc.summary}</span>}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '86%',
                  padding: '9px 13px',
                  borderRadius: msg.role === 'user' ? '16px 16px 3px 16px' : '16px 16px 16px 3px',
                  background: msg.role === 'user' ? '#7c2d3e' : '#f1f5f9',
                  color: msg.role === 'user' ? '#fff' : '#0f172a',
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {msg.content || (msg.isStreaming ? <BlinkCursor /> : '…')}
                  {msg.isStreaming && msg.content && <BlinkCursor />}
                </div>
              </div>
            </div>
          ))}

          {/* Live tool calls while streaming */}
          {liveTools.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {liveTools.map((tc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', background: tc.status === 'done' ? '#f8fafc' : '#fffbeb', border: `1px solid ${tc.status === 'done' ? '#e2e8f0' : '#fde68a'}`, borderRadius: 8, fontSize: 11.5, color: tc.status === 'done' ? '#64748b' : '#92400e' }}>
                  {tc.status === 'running' ? (
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: '2px solid #f59e0b', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  ) : (
                    <span style={{ color: '#22c55e', fontWeight: 700 }}>✓</span>
                  )}
                  <span>{TOOL_LABELS[tc.name] || tc.name}</span>
                  {tc.summary && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>{tc.summary}</span>}
                </div>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '8px 10px 8px 14px', transition: 'border-color 0.15s' }}
            onFocus={() => {}} // handled by child
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask ARIA anything…"
              disabled={isLoading}
              rows={1}
              style={{ flex: 1, border: 'none', background: 'transparent', resize: 'none', outline: 'none', fontSize: 13.5, lineHeight: 1.5, maxHeight: 110, overflowY: 'auto', color: '#0f172a' }}
              onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 110) + 'px'; }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              style={{ width: 32, height: 32, borderRadius: '50%', background: input.trim() && !isLoading ? '#7c2d3e' : '#e2e8f0', color: input.trim() && !isLoading ? '#fff' : '#94a3b8', border: 'none', cursor: input.trim() && !isLoading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.18s,color 0.18s' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/></svg>
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 5, textAlign: 'center' }}>Enter to send · Shift+Enter for new line</div>
        </div>
      </div>

      {/* Spin keyframe for tool spinner */}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
