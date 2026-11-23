import { useState, useEffect, useRef } from 'react';
import Layout from '../components/layout/Layout';
import {
  streamCopilotChat,
  resolveCopilotInterrupt,
  sendCopilotVoice,
  getCopilotMessages,
  clearCopilotHistory,
  checkCopilotHealth,
  COPILOT_BASE_URL,
} from '../api/copilot';
import type { CopilotMessage, CopilotInterrupt } from '../api/copilot';
import toast from 'react-hot-toast';

const QUICK_PROMPTS = [
  'Spent ₹250 on lunch',
  'Show my recent expenses',
  "What is this month's spending breakdown?",
  'Add ₹500 for petrol under Transport',
];

export default function CopilotPage() {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeInterrupt, setActiveInterrupt] = useState<CopilotInterrupt | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isResolvingInterrupt, setIsResolvingInterrupt] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeInterrupt]);

  // Load message history & verify health
  useEffect(() => {
    let isMounted = true;

    async function init() {
      const isOnline = await checkCopilotHealth();
      if (isMounted) setBackendOnline(isOnline);

      const history = await getCopilotMessages(30);
      if (isMounted) {
        if (history.length > 0) {
          setMessages(history);
          setBackendOnline(true);
        }
      }
    }

    init();

    // Periodic heartbeat every 15s to keep status accurate
    const interval = setInterval(async () => {
      const isOnline = await checkCopilotHealth();
      if (isMounted) setBackendOnline(isOnline);
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleClear = async () => {
    try {
      await clearCopilotHistory();
      setMessages([]);
      setActiveInterrupt(null);
      toast.success('Chat history cleared');
    } catch {
      toast.error('Failed to clear chat');
    }
  };

  const handleSendPrompt = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isStreaming) return;

    setInputPrompt('');
    setIsStreaming(true);
    setActiveInterrupt(null);

    // Append user message
    const userMsg: CopilotMessage = {
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    };

    // Append temporary assistant placeholder
    const assistantMsg: CopilotMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    let accumulatedContent = '';

    await streamCopilotChat(prompt, {
      onToken: (delta) => {
        accumulatedContent += delta;
        setBackendOnline(true);
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: accumulatedContent,
            };
          }
          return updated;
        });
      },
      onInterrupt: (interrupt) => {
        setIsStreaming(false);
        setActiveInterrupt(interrupt);
        // Remove empty assistant placeholder if no content streamed yet
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'assistant' && !updated[lastIdx].content) {
            updated.pop();
          }
          return updated;
        });
      },
      onDone: () => {
        setIsStreaming(false);
      },
      onError: (err) => {
        setIsStreaming(false);
        toast.error(err);
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'assistant' && !updated[lastIdx].content) {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: `⚠️ Failed to get response: ${err}`,
            };
          }
          return updated;
        });
      },
    });
  };

  // Human-in-the-Loop decision resolution
  const handleApprovalDecision = async (approve: boolean) => {
    if (!activeInterrupt || isResolvingInterrupt) return;

    setIsResolvingInterrupt(true);
    try {
      const res = await resolveCopilotInterrupt(activeInterrupt.id, approve);
      setActiveInterrupt(null);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.content || (approve ? 'Action confirmed and executed.' : 'Action cancelled by you.'),
          timestamp: new Date().toISOString(),
        },
      ]);
      toast.success(approve ? 'Action approved!' : 'Action cancelled.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit decision');
    } finally {
      setIsResolvingInterrupt(false);
    }
  };

  // Audio Voice Recording
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size < 100) return;

        const loadingToast = toast.loading('Transcribing audio...');
        try {
          const userMsg: CopilotMessage = {
            role: 'user',
            content: '🎙️ [Voice Audio Memo]',
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, userMsg]);

          const result = await sendCopilotVoice(audioBlob);
          toast.dismiss(loadingToast);

          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: result.content || 'Voice processed.',
              timestamp: new Date().toISOString(),
            },
          ]);
        } catch (err: any) {
          toast.dismiss(loadingToast);
          toast.error(err.message || 'Voice transcription failed');
        }
      };

      recorder.start();
      setIsRecording(true);
      toast('Recording... Click mic again to send', { icon: '🎙️' });
    } catch {
      toast.error('Microphone access denied or unavailable');
    }
  };

  return (
    <Layout title="AI Copilot">
      <div className="max-w-3xl mx-auto px-4 py-3 flex flex-col h-[calc(100dvh-7.5rem)]">
        {/* Status notice if offline */}
        {backendOnline === false && (
          <div
            className="mb-3 p-3 rounded-2xl text-xs flex items-center justify-between shadow-xs transition-all animate-in fade-in"
            style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base" style={{ color: '#d97706' }}>wifi_off</span>
              <span className="font-medium">Connecting to Copilot service on {COPILOT_BASE_URL}...</span>
            </div>
            <button
              type="button"
              onClick={async () => {
                const ok = await checkCopilotHealth();
                setBackendOnline(ok);
                if (ok) toast.success('Copilot service connected!');
                else toast.error('Service still unreachable on port 8001');
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all active:scale-95"
              style={{ backgroundColor: '#fef3c7', color: '#78350f', border: '1px solid #fcd34d' }}
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Chat Actions Bar */}
        {messages.length > 0 && (
          <div className="flex justify-end pb-2">
            <button
              onClick={handleClear}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-on-surface-variant hover:text-error bg-surface-container hover:bg-error/10 border border-outline-variant/30 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">delete_sweep</span>
              Clear Chat
            </button>
          </div>
        )}

        {/* Conversation Stream Feed */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3">
              <div
                className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}
              >
                <span className="material-symbols-outlined text-3xl" style={{ color: '#2563eb' }}>auto_awesome</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">How can I help with your budget?</h2>
              <p className="text-sm max-w-sm text-slate-500">
                Record expenses instantly, ask for spending summaries, or request financial insights.
              </p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role !== 'user' && (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-xs"
                    style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb' }}
                  >
                    <span className="material-symbols-outlined text-base">auto_awesome</span>
                  </div>
                )}

                <div
                  className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm"
                  style={
                    msg.role === 'user'
                      ? {
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          borderTopRightRadius: '4px',
                          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                        }
                      : {
                          backgroundColor: '#ffffff',
                          color: '#0f172a',
                          border: '1px solid #e2e8f0',
                          borderTopLeftRadius: '4px',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                        }
                  }
                >
                  {msg.content ? (
                    <div
                      style={{ color: msg.role === 'user' ? '#ffffff' : '#0f172a' }}
                      className={msg.role === 'user' ? 'font-medium' : 'whitespace-pre-wrap'}
                    >
                      {msg.content}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 py-1" style={{ color: '#2563eb' }}>
                      <span className="inline-block w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: '#2563eb' }} />
                      <span className="inline-block w-2 h-2 rounded-full animate-bounce [animation-delay:0.2s]" style={{ backgroundColor: '#2563eb' }} />
                      <span className="inline-block w-2 h-2 rounded-full animate-bounce [animation-delay:0.4s]" style={{ backgroundColor: '#2563eb' }} />
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-xs"
                    style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                  >
                    <span className="material-symbols-outlined text-base">person</span>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Interactive Human-In-The-Loop Approval Card */}
          {activeInterrupt && (
            <div
              className="animate-in fade-in slide-in-from-bottom-3 duration-300 my-4 p-4 rounded-3xl backdrop-blur-md shadow-xl"
              style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)' }}
            >
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider mb-2" style={{ color: '#d97706' }}>
                <span className="material-symbols-outlined text-base">warning</span>
                <span>Confirmation Required</span>
              </div>

              <h4 className="font-semibold text-slate-900 text-sm mb-1">
                Action: {activeInterrupt.name?.replace(/_/g, ' ').toUpperCase() || 'FINANCIAL ACTION'}
              </h4>

              <p className="text-xs text-slate-600 mb-3">
                {activeInterrupt.description || 'The copilot is requesting permission to modify your records.'}
              </p>

              {activeInterrupt.args && Object.keys(activeInterrupt.args).length > 0 && (
                <div
                  className="rounded-2xl p-2.5 mb-3 text-xs font-mono space-y-1"
                  style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}
                >
                  {Object.entries(activeInterrupt.args).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-slate-500">{k}:</span>
                      <span className="font-semibold text-slate-800">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isResolvingInterrupt}
                  onClick={() => handleApprovalDecision(true)}
                  className="flex-1 py-2 px-3 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-1 transition-all disabled:opacity-50 shadow-sm"
                  style={{ backgroundColor: '#16a34a' }}
                >
                  <span className="material-symbols-outlined text-sm">check</span>
                  Approve
                </button>
                <button
                  type="button"
                  disabled={isResolvingInterrupt}
                  onClick={() => handleApprovalDecision(false)}
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                  style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                  Reject
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div className="pt-2 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={isStreaming}
              onClick={() => handleSendPrompt(prompt)}
              className="text-[12px] whitespace-nowrap px-3.5 py-1.5 rounded-full font-medium transition-all shrink-0 active:scale-95 hover:border-blue-400 hover:text-blue-600 shadow-2xs"
              style={{ backgroundColor: '#ffffff', color: '#334155', border: '1px solid #cbd5e1' }}
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Composer Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt();
          }}
          className="flex items-center gap-2 p-1.5 rounded-3xl shadow-md backdrop-blur-xl"
          style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}
        >
          <button
            type="button"
            onClick={toggleRecording}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 active:scale-95"
            style={
              isRecording
                ? {
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.3)',
                  }
                : {
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                  }
            }
            title={isRecording ? 'Stop Recording' : 'Voice Memo'}
          >
            <span className="material-symbols-outlined text-xl">
              {isRecording ? 'graphic_eq' : 'mic'}
            </span>
          </button>

          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            disabled={isStreaming}
            placeholder="Type an expense, or ask for insights..."
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
            style={{ color: '#0f172a' }}
          />

          <button
            type="submit"
            disabled={!inputPrompt.trim() || isStreaming}
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            style={
              inputPrompt.trim() && !isStreaming
                ? {
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
                  }
                : {
                    backgroundColor: '#f1f5f9',
                    color: '#94a3b8',
                    border: '1px solid #e2e8f0',
                  }
            }
            title="Send Message"
          >
            <span className="material-symbols-outlined text-xl">send</span>
          </button>
        </form>
      </div>
    </Layout>
  );
}
