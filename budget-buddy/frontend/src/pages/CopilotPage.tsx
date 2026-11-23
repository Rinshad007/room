import { useState, useEffect, useRef } from 'react';
import Layout from '../components/layout/Layout';
import {
  streamCopilotChat,
  resolveCopilotInterrupt,
  sendCopilotVoice,
  getCopilotMessages,
  clearCopilotHistory,
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
      // Check health
      try {
        const ping = await fetch(`${COPILOT_BASE_URL}/api/messages?limit=1`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token') || 'demo_user'}`,
          },
        });
        if (isMounted) setBackendOnline(ping.status !== 502 && ping.status !== 503);
      } catch {
        if (isMounted) setBackendOnline(false);
      }

      // Fetch history
      const history = await getCopilotMessages(30);
      if (isMounted && history.length > 0) {
        setMessages(history);
      }
    }

    init();
    return () => {
      isMounted = false;
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
          <div className="mb-2 p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">wifi_off</span>
              <span>Copilot backend service is not running on {COPILOT_BASE_URL}</span>
            </div>
            <span className="text-[10px] font-mono opacity-80">Start uvicorn on port 8001</span>
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
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-on-surface-variant space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <span className="material-symbols-outlined text-3xl text-emerald-600">auto_awesome</span>
              </div>
              <h2 className="text-xl font-bold text-on-surface">How can I help with your budget?</h2>
              <p className="text-sm max-w-sm text-on-surface-variant">
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
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <span className="material-symbols-outlined text-base text-emerald-600">auto_awesome</span>
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-xs font-normal shadow-sm shadow-emerald-700/10'
                      : 'bg-white border border-outline-variant/40 text-on-surface rounded-tl-xs shadow-xs whitespace-pre-wrap'
                  }`}
                >
                  {msg.content ? (
                    <div>{msg.content}</div>
                  ) : (
                    <div className="flex items-center gap-1.5 py-1 text-emerald-600">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/40 flex items-center justify-center shrink-0 mt-0.5 text-on-surface-variant shadow-xs">
                    <span className="material-symbols-outlined text-base">person</span>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Interactive Human-In-The-Loop Approval Card */}
          {activeInterrupt && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300 my-4 p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 backdrop-blur-md shadow-xl">
              <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-wider mb-2">
                <span className="material-symbols-outlined text-base">warning</span>
                <span>Confirmation Required</span>
              </div>

              <h4 className="font-semibold text-on-surface text-sm mb-1">
                Action: {activeInterrupt.name?.replace(/_/g, ' ').toUpperCase() || 'FINANCIAL ACTION'}
              </h4>

              <p className="text-xs text-on-surface-variant mb-3">
                {activeInterrupt.description || 'The copilot is requesting permission to modify your records.'}
              </p>

              {activeInterrupt.args && Object.keys(activeInterrupt.args).length > 0 && (
                <div className="bg-white/80 rounded-2xl p-2.5 mb-3 border border-outline-variant/30 text-xs font-mono space-y-1">
                  {Object.entries(activeInterrupt.args).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-on-surface-variant">{k}:</span>
                      <span className="font-semibold text-on-surface">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isResolvingInterrupt}
                  onClick={() => handleApprovalDecision(true)}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors disabled:opacity-50 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">check</span>
                  Approve
                </button>
                <button
                  type="button"
                  disabled={isResolvingInterrupt}
                  onClick={() => handleApprovalDecision(false)}
                  className="flex-1 py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-error text-xs font-semibold flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
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
              className="text-[12px] whitespace-nowrap px-3.5 py-1.5 rounded-full bg-surface-container hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-outline-variant/30 text-on-surface-variant font-medium transition-all shrink-0 active:scale-95"
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
          className="flex items-center gap-2 p-1.5 rounded-3xl bg-white border border-outline-variant/40 shadow-card backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={toggleRecording}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
              isRecording
                ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30 ring-2 ring-rose-300'
                : 'bg-surface-container hover:bg-emerald-50 text-on-surface-variant hover:text-emerald-700 border border-outline-variant/30 active:scale-95'
            }`}
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
            className="flex-1 bg-transparent px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none"
          />

          <button
            type="submit"
            disabled={!inputPrompt.trim() || isStreaming}
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white flex items-center justify-center shrink-0 disabled:opacity-35 disabled:cursor-not-allowed disabled:bg-none disabled:bg-surface-container disabled:text-on-surface-variant/40 shadow-sm shadow-emerald-600/20 active:scale-95 transition-all"
            title="Send Message"
          >
            <span className="material-symbols-outlined text-xl">send</span>
          </button>
        </form>
      </div>
    </Layout>
  );
}
