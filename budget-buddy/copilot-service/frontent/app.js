// ── State ──
let AUTH_TOKEN = localStorage.getItem("copilot_token") || "";
let isStreaming = false;

// ── Init ──
document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("prompt-input");
    input.addEventListener("input", () => {
        document.getElementById("send-btn").disabled = !input.value.trim();
    });
    if (AUTH_TOKEN) {
        document.getElementById("token-input").value = AUTH_TOKEN;
        setToken();
    }
});

// ── Auth ──
function readAuth() {
    return AUTH_TOKEN ? { access_token: AUTH_TOKEN } : null;
}

function setToken() {
    const input = document.getElementById("token-input");
    AUTH_TOKEN = input.value.trim();
    if (AUTH_TOKEN) {
        localStorage.setItem("copilot_token", AUTH_TOKEN);
        document.getElementById("auth-status").textContent = "✓ Connected";
        document.getElementById("auth-status").style.color = "#4caf50";
        loadHistory();
    }
}

// ── Message rendering ──
function appendMessage(role, text) {
    const container = document.getElementById("conversation");
    const emptyState = document.getElementById("empty-state");
    if (emptyState) emptyState.remove();

    const bubble = document.createElement("div");
    bubble.className = `message ${role}`;
    bubble.textContent = text;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
    return bubble;
}

// ── Load chat history ──
async function loadHistory() {
    if (!AUTH_TOKEN) return;
    try {
        const res = await fetch("/api/messages?limit=50", {
            headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        });
        if (!res.ok) return;
        const messages = await res.json();
        const container = document.getElementById("conversation");
        // Clear existing
        container.innerHTML = "";
        if (messages.length === 0) {
            container.innerHTML = `
                <div class="empty-state" id="empty-state">
                    <span class="emoji">💬</span>
                    <p>Say something like "Spent 240 on lunch" or "Show my expenses"</p>
                </div>`;
            return;
        }
        for (const msg of messages) {
            appendMessage(msg.role, msg.content);
        }
    } catch (e) {
        console.error("Failed to load history:", e);
    }
}

// ── Form submit ──
function handleSubmit(event) {
    event.preventDefault();
    const input = document.getElementById("prompt-input");
    const text = input.value.trim();
    if (!text || isStreaming) return;
    input.value = "";
    document.getElementById("send-btn").disabled = true;
    sendStreamingPrompt(text);
}

// ── SSE Streaming ──
async function sendStreamingPrompt(promptText) {
    const auth = readAuth();
    if (!auth) return alert("Please paste your JWT token first.");

    isStreaming = true;
    document.getElementById("status-indicator").textContent = "● Thinking...";
    document.getElementById("status-indicator").style.color = "#ffb300";

    appendMessage("user", promptText);
    const assistantBubble = appendMessage("assistant", "...");

    try {
        const response = await fetch(
            `/api/chat/stream?prompt=${encodeURIComponent(promptText)}`,
            {
                method: "POST",
                headers: { Authorization: `Bearer ${auth.access_token}` },
            }
        );

        if (!response.ok) {
            assistantBubble.textContent = `Error: ${response.status} ${response.statusText}`;
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let currentEvent = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const rawChunk = decoder.decode(value, { stream: true });
            const lines = rawChunk.split("\n");

            for (const line of lines) {
                if (line.startsWith("event: ")) {
                    currentEvent = line.slice(7).trim();
                } else if (line.startsWith("data: ")) {
                    try {
                        const payload = JSON.parse(line.slice(6));

                        if (currentEvent === "token" && payload.delta) {
                            fullText += payload.delta;
                            assistantBubble.textContent = fullText;
                            document.getElementById("conversation").scrollTop =
                                document.getElementById("conversation").scrollHeight;
                        } else if (currentEvent === "interrupt" || payload.type === "interrupt") {
                            assistantBubble.remove();
                            renderApprovalCard(payload);
                        } else if (currentEvent === "done") {
                            // Stream complete
                        } else if (currentEvent === "error") {
                            assistantBubble.textContent = `Error: ${payload.error}`;
                        }
                    } catch (_) {}
                }
            }
        }

        if (!fullText && assistantBubble.textContent === "...") {
            assistantBubble.textContent = "Done.";
        }
    } catch (err) {
        assistantBubble.textContent = `Connection error: ${err.message}`;
    } finally {
        isStreaming = false;
        document.getElementById("status-indicator").textContent = "● Ready";
        document.getElementById("status-indicator").style.color = "#4caf50";
    }
}

// ── Approval Card ──
function renderApprovalCard(interrupt) {
    const container = document.getElementById("conversation");
    const card = document.createElement("div");
    card.className = "approval-card";
    card.id = `interrupt-${interrupt.id}`;

    const args = interrupt.args || {};
    const argsHtml = Object.entries(args)
        .map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`)
        .join("");

    card.innerHTML = `
        <div class="card-warning">⚠️ Confirmation Required</div>
        <h4>Action: ${(interrupt.name || "action").replace(/_/g, " ").toUpperCase()}</h4>
        <p>${interrupt.description || "The assistant is asking for permission to modify your records."}</p>
        <div class="args-preview">${argsHtml || "<em>No parameters</em>"}</div>
        <div class="action-buttons">
            <button class="btn-approve" onclick="resolveApproval('${interrupt.id}', true)">✓ Approve</button>
            <button class="btn-reject" onclick="resolveApproval('${interrupt.id}', false)">✗ Reject</button>
        </div>
    `;
    container.appendChild(card);
    card.scrollIntoView({ behavior: "smooth" });
}

// ── Approval Resolution ──
async function resolveApproval(interruptId, approved) {
    const auth = readAuth();
    if (!auth) return;

    document.getElementById("status-indicator").textContent = approved ? "● Executing..." : "● Cancelling...";

    try {
        const res = await fetch("/api/chat/approve", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${auth.access_token}`,
            },
            body: JSON.stringify({ interrupt_id: interruptId, approve: approved }),
        });
        const result = await res.json();
        const card = document.getElementById(`interrupt-${interruptId}`);
        if (card) card.remove();
        appendMessage("assistant", result.content || (approved ? "Action confirmed." : "Action cancelled."));
    } catch (err) {
        appendMessage("assistant", `Approval failed: ${err.message}`);
    } finally {
        document.getElementById("status-indicator").textContent = "● Ready";
        document.getElementById("status-indicator").style.color = "#4caf50";
    }
}

// ── Microphone ──
async function handleMic() {
    const auth = readAuth();
    if (!auth) return alert("Please paste your JWT token first.");

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const chunks = [];

        document.getElementById("mic-btn").textContent = "🔴";
        document.getElementById("mic-btn").style.background = "#ef5350";

        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach((t) => t.stop());
            document.getElementById("mic-btn").textContent = "🎙️";
            document.getElementById("mic-btn").style.background = "";

            const blob = new Blob(chunks, { type: "audio/webm" });
            const formData = new FormData();
            formData.append("audio", blob, "recording.webm");

            appendMessage("user", "🎙️ [Voice message]");
            const assistantBubble = appendMessage("assistant", "Processing voice...");

            try {
                const res = await fetch("/api/chat/microphone", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${auth.access_token}` },
                    body: formData,
                });
                const result = await res.json();
                assistantBubble.textContent = result.content || "Done.";
            } catch (err) {
                assistantBubble.textContent = `Voice error: ${err.message}`;
            }
        };

        mediaRecorder.start();
        setTimeout(() => {
            if (mediaRecorder.state === "recording") {
                mediaRecorder.stop();
            }
        }, 10000); // Max 10s recording

        // Click again to stop early
        document.getElementById("mic-btn").onclick = () => {
            if (mediaRecorder.state === "recording") {
                mediaRecorder.stop();
            }
            document.getElementById("mic-btn").onclick = handleMic;
        };
    } catch (err) {
        alert("Microphone access denied or not available.");
    }
}
