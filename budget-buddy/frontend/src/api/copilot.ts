const rawCopilotUrl = import.meta.env.VITE_COPILOT_URL || 'http://localhost:8001';
export const COPILOT_BASE_URL = rawCopilotUrl.replace(/\/+$/, '');

export interface CopilotInterrupt {
  type: 'interrupt';
  id: string;
  name: string;
  args: Record<string, any>;
  description?: string;
  allowed_decisions?: string[];
}

export interface CopilotMessage {
  id?: number | string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  interrupt?: CopilotInterrupt;
}

const getAuthToken = (): string => {
  const token = localStorage.getItem('access_token');
  if (!token || token === 'undefined' || token === 'null') {
    return 'demo_user';
  }
  return token;
};

export async function getCopilotMessages(limit = 50): Promise<CopilotMessage[]> {
  const token = getAuthToken();

  try {
    const res = await fetch(`${COPILOT_BASE_URL}/api/messages?limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.map((item: any) => ({
      id: item.id,
      role: item.role,
      content: typeof item.content === 'string' ? item.content : item.content?.content || JSON.stringify(item.content),
      timestamp: item.timestamp,
    }));
  } catch (err) {
    console.warn('Failed to fetch copilot messages:', err);
    return [];
  }
}

export async function streamCopilotChat(
  prompt: string,
  callbacks: {
    onToken: (delta: string) => void;
    onInterrupt: (interrupt: CopilotInterrupt) => void;
    onDone: () => void;
    onError: (error: string) => void;
  }
): Promise<void> {
  const token = getAuthToken();

  try {
    const res = await fetch(
      `${COPILOT_BASE_URL}/api/chat/stream?prompt=${encodeURIComponent(prompt)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      callbacks.onError(`HTTP Error ${res.status}: ${res.statusText}`);
      return;
    }

    if (!res.body) {
      callbacks.onError('Response body is empty');
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let currentEvent = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const rawChunk = decoder.decode(value, { stream: true });
      const lines = rawChunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          try {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;
            const payload = JSON.parse(dataStr);

            if (currentEvent === 'token' && payload.delta) {
              callbacks.onToken(payload.delta);
            } else if (currentEvent === 'interrupt' || payload.type === 'interrupt') {
              callbacks.onInterrupt(payload);
            } else if (currentEvent === 'done') {
              callbacks.onDone();
            } else if (currentEvent === 'error') {
              callbacks.onError(payload.error || 'Unknown copilot streaming error');
            }
          } catch {
            // Partial JSON chunk, ignore
          }
        }
      }
    }

    callbacks.onDone();
  } catch (err: any) {
    callbacks.onError(err.message || 'Network connection failed.');
  }
}

export async function resolveCopilotInterrupt(
  interruptId: string,
  approve: boolean
): Promise<{ content: string; role: string }> {
  const token = getAuthToken();
  const res = await fetch(`${COPILOT_BASE_URL}/api/chat/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      interrupt_id: interruptId,
      approve,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to resolve approval: ${res.statusText}`);
  }

  return res.json();
}

export async function sendCopilotVoice(
  audioBlob: Blob
): Promise<{ content: string; role: string }> {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const res = await fetch(`${COPILOT_BASE_URL}/api/chat/microphone`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Voice transcription failed: ${res.statusText}`);
  }

  return res.json();
}

export async function clearCopilotHistory(): Promise<void> {
  const token = getAuthToken();
  try {
    await fetch(`${COPILOT_BASE_URL}/api/chat/clear`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    console.warn('Failed to clear copilot history:', err);
  }
}


