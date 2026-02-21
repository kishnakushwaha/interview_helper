/**
 * DesierAI Desktop – Renderer Logic
 *
 * Handles login (Supabase REST), question submission,
 * and display of AI-generated answers.
 */

const API = "http://localhost:8000";
const SUPABASE_URL = "https://uptdcwqxxwesfbzdlbdj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_iWcbs-0OGigM2j9kbYvSMQ_tKZFZUSZ";

let accessToken = null;
let liveSessionHistory = []; // Session memory
let isVoiceModeActive = false;
let mediaRecorder = null;
let voiceCycleInterval = null;

// ── Supabase Login ───────────────────────────────
async function handleLogin() {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();
    const errorEl = document.getElementById("login-error");
    const btn = document.getElementById("btn-login");

    errorEl.classList.add("hidden");

    if (!email || !password) {
        errorEl.textContent = "Enter email and password.";
        errorEl.classList.remove("hidden");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Logging in...";

    try {
        const res = await fetch(
            `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    apikey: SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ email, password }),
            }
        );

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error_description || err.msg || "Login failed");
        }

        const data = await res.json();
        accessToken = data.access_token;

        // Store token in main process
        await window.desierAPI.setToken(accessToken);

        // Switch to main view
        document.getElementById("view-login").classList.add("hidden");
        document.getElementById("view-main").classList.remove("hidden");
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove("hidden");
    } finally {
        btn.disabled = false;
        btn.textContent = "Login";
    }
}

// ── Ask question ─────────────────────────────────
async function askQuestion() {
    const question = document.getElementById("input-question").value.trim();
    const role = document.getElementById("input-role").value.trim();
    const level = document.getElementById("input-level").value;
    const errorEl = document.getElementById("ask-error");
    const btn = document.getElementById("btn-ask");
    const answerArea = document.getElementById("answer-area");

    errorEl.classList.add("hidden");

    if (!question) {
        errorEl.textContent = "Paste a question first.";
        errorEl.classList.remove("hidden");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Thinking...";

    try {
        const res = await fetch(`${API}/interview/live-answer`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                question,
                role,
                level,
                history: liveSessionHistory
            }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Failed to get answer");
        }

        const data = await res.json();

        // Store in history
        if (data.answer) {
            liveSessionHistory.push({
                question: question,
                answer: data.answer
            });
        }

        // Display answer & level
        const levelDisplay = data.detected_level ? ` • ${data.detected_level.toUpperCase()}` : "";
        document.querySelector(".answer-header .label").textContent = `Your Answer${levelDisplay}`;
        document.getElementById("answer-text").textContent =
            data.answer || "No answer generated.";

        // Display code block
        const codeSection = document.getElementById("code-section");
        if (data.code) {
            document.getElementById("code-text").textContent = data.code;
            document.getElementById("code-lang").textContent = (data.code_language || "CODE").toUpperCase();
            codeSection.classList.remove("hidden");
        } else {
            codeSection.classList.add("hidden");
        }

        // Display key points
        const kpList = document.getElementById("key-points");
        kpList.innerHTML = "";
        (data.key_points || []).forEach((point) => {
            const li = document.createElement("li");
            li.textContent = point;
            kpList.appendChild(li);
        });

        // Display tip
        document.getElementById("tip-text").textContent = data.tip || "";

        answerArea.classList.remove("hidden");

        // Scroll answer into view if needed
        answerArea.scrollIntoView({ behavior: "smooth", block: "nearest" });

    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove("hidden");
    } finally {
        btn.disabled = false;
        btn.textContent = "⚡ Get Answer";
    }
}

// ── Voice Mode ──────────────────────────────────
async function toggleVoiceMode() {
    const btn = document.getElementById("btn-voice");
    const errorEl = document.getElementById("ask-error");
    errorEl.classList.add("hidden");

    if (isVoiceModeActive) {
        stopVoiceMode();
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isVoiceModeActive = true;
        btn.textContent = "🛑 Stop Listening";
        btn.style.background = "rgba(220, 38, 38, 0.1)";
        btn.style.borderColor = "#dc2626";
        btn.style.color = "#ef4444";

        document.getElementById("voice-status").classList.remove("hidden");
        document.getElementById("voice-status").textContent = "🎙️ Mic Active";

        startVoiceCycle(stream);
    } catch (err) {
        console.error("Mic access denied:", err);
        errorEl.textContent = "Microphone access denied: " + err.message;
        errorEl.classList.remove("hidden");
    }
}

function stopVoiceMode() {
    isVoiceModeActive = false;
    const btn = document.getElementById("btn-voice");
    btn.textContent = "🎙️ Voice Mode";
    btn.style.background = "rgba(56,189,248,0.1)";
    btn.style.borderColor = "rgba(56,189,248,0.3)";
    btn.style.color = "#38bdf8";

    document.getElementById("voice-status").classList.add("hidden");

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }

    if (voiceCycleInterval) {
        clearInterval(voiceCycleInterval);
    }
}

async function startVoiceCycle(stream) {
    console.log("Starting voice cycle...");

    const recordChunk = () => {
        if (!isVoiceModeActive) return;

        console.log("Recording chunk...");
        document.getElementById("voice-status").textContent = "🎙️ Listening...";

        const chunks = [];
        const mimeType = ['audio/webm;codecs=opus', 'audio/webm', ''].find(m => m === '' || MediaRecorder.isTypeSupported(m));
        mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            console.log("Recording stopped. Chunk size:", chunks.length);
            if (chunks.length > 0) {
                const blob = new Blob(chunks, { type: "audio/webm" });
                processVoiceChunk(blob);
            }
            if (isVoiceModeActive) {
                setTimeout(recordChunk, 100);
            }
        };

        mediaRecorder.start();
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === "recording") {
                mediaRecorder.stop();
            }
        }, 8000); // 8 second chunks
    };

    recordChunk();
}

async function processVoiceChunk(blob) {
    console.log("Uploading audio chunk...");
    document.getElementById("voice-status").textContent = "📤 Analyzing...";

    const formData = new FormData();
    formData.append("file", blob, "chunk.webm");
    formData.append("role", document.getElementById("input-role").value.trim());
    formData.append("level", document.getElementById("input-level").value);
    formData.append("history", JSON.stringify(liveSessionHistory));

    try {
        const res = await fetch(`${API}/audio/listen-and-answer`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            body: formData,
        });

        if (!res.ok) {
            console.error("API Error status:", res.status);
            return;
        }

        const data = await res.json();
        console.log("Transcription:", data.transcript);

        if (data.transcript && data.transcript.trim()) {
            displayLiveAnswer(data);

            liveSessionHistory.push({
                question: data.transcript,
                answer: data.answer
            });
            if (liveSessionHistory.length > 10) liveSessionHistory.shift();
        }
    } catch (err) {
        console.error("Fetch error:", err);
    }
}

function displayLiveAnswer(data) {
    const answerArea = document.getElementById("answer-area");
    const levelDisplay = data.detected_level ? ` • ${data.detected_level.toUpperCase()}` : "";

    document.querySelector(".answer-header .label").textContent = `Your Answer${levelDisplay}`;
    document.getElementById("answer-text").textContent = data.answer || "No answer generated.";
    document.getElementById("input-question").value = data.transcript; // Show what was heard

    const codeSection = document.getElementById("code-section");
    if (data.code) {
        document.getElementById("code-text").textContent = data.code;
        document.getElementById("code-lang").textContent = (data.code_language || "CODE").toUpperCase();
        codeSection.classList.remove("hidden");
    } else {
        codeSection.classList.add("hidden");
    }

    const kpList = document.getElementById("key-points");
    kpList.innerHTML = "";
    (data.key_points || []).forEach((point) => {
        const li = document.createElement("li");
        li.textContent = point;
        kpList.appendChild(li);
    });

    document.getElementById("tip-text").textContent = data.tip || "";
    answerArea.classList.remove("hidden");
}

// ── Clipboard helpers ────────────────────────────
function copyAnswer() {
    const text = document.getElementById("answer-text").textContent;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector(".answer-header .copy-btn");
        const originalContent = btn.textContent;
        btn.textContent = "✅";
        setTimeout(() => (btn.textContent = originalContent), 1500);
    });
}

function copyCode() {
    const text = document.getElementById("code-text").textContent;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector("#code-section .copy-btn");
        const originalContent = btn.textContent;
        btn.textContent = "✅";
        setTimeout(() => (btn.textContent = originalContent), 1500);
    });
}

// ── Keyboard shortcuts ───────────────────────────
document.addEventListener("keydown", (e) => {
    // Ctrl/Cmd+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        const mainView = document.getElementById("view-main");
        if (!mainView.classList.contains("hidden")) {
            askQuestion();
        } else {
            handleLogin();
        }
    }
});

// ── Password field Enter key ─────────────────────
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("login-password").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleLogin();
        }
    });

    // Check if we have a stored token
    window.desierAPI.getToken().then((token) => {
        if (token) {
            accessToken = token;
            document.getElementById("view-login").classList.add("hidden");
            document.getElementById("view-main").classList.remove("hidden");
        }
    });

    // ── Focus Management for Stealth ─────────────────
    // Only allow window to take focus when user intends to type.
    const inputs = document.querySelectorAll("input, textarea, select");

    inputs.forEach((el) => {
        // When clicking input, tell main process to enable focus
        el.addEventListener("mousedown", () => {
            window.desierAPI.setFocusable(true);
            // Short timeout to allow focus-change to propagate from main
            setTimeout(() => el.focus(), 50);
        });

        // When blurring, revert to non-focusable (stealth mode)
        el.addEventListener("blur", () => {
            // Delay check to see if focus moved to another input
            setTimeout(() => {
                const active = document.activeElement;
                const isInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT");

                if (!isInput) {
                    window.desierAPI.setFocusable(false);
                }
            }, 100);
        });
    });
});
