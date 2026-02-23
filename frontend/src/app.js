/* ═══════════════════════════════════════════════
   DesierAI – Frontend Application
   ═══════════════════════════════════════════════ */

const API = "https://intervu-vfbb.onrender.com";

// Supabase settings (same as backend .env)
const SUPABASE_URL = "https://uptdcwqxxwesfbzdlbdj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_iWcbs-0OGigM2j9kbYvSMQ_tKZFZUSZ";

// Live session memory — stores Q&A history for contextual answers
let liveSessionHistory = [];

// ── State ──────────────────────────────────────
let accessToken = localStorage.getItem("access_token") || null;
let currentPage = "auth";
let interviewState = {
    sessionId: null,
    questions: [],
    currentIndex: 0,
    scores: [],
};

// ══════════════════════════════════════════════
//  SUPABASE AUTH (direct REST API)
// ══════════════════════════════════════════════

async function supabaseSignUp(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
    });
    return res.json();
}

async function supabaseLogin(email, password) {
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
    return res.json();
}

// ══════════════════════════════════════════════
//  API HELPERS
// ══════════════════════════════════════════════

function authHeaders() {
    return {
        Authorization: `Bearer ${accessToken}`,
    };
}

async function apiFetch(path, options = {}) {
    const res = await fetch(`${API}${path}`, {
        ...options,
        headers: {
            ...authHeaders(),
            ...(options.headers || {}),
        },
    });

    if (res.status === 401) {
        logout();
        throw new Error("Session expired");
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Request failed (${res.status})`);
    }

    return res.json();
}

// ══════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════

function navigate(page) {
    // Hide all pages
    document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));

    // Show target page
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.remove("hidden");

    // Nav visibility
    const nav = document.getElementById("main-nav");
    if (page === "auth") {
        nav.classList.add("hidden");
    } else {
        nav.classList.remove("hidden");
    }

    // Active nav link
    document.querySelectorAll(".nav-links a").forEach((a) => a.classList.remove("active"));
    const activeLink = document.getElementById(`nav-${page}`);
    if (activeLink) activeLink.classList.add("active");

    currentPage = page;

    // Page-specific init
    if (page === "dashboard") initDashboard();
    if (page === "history") loadHistory();
}

// ══════════════════════════════════════════════
//  AUTH HANDLERS
// ══════════════════════════════════════════════

function switchAuthTab(tab) {
    document.getElementById("tab-login").classList.toggle("active", tab === "login");
    document.getElementById("tab-signup").classList.toggle("active", tab === "signup");
    document.getElementById("form-login").classList.toggle("hidden", tab !== "login");
    document.getElementById("form-signup").classList.toggle("hidden", tab !== "signup");

    // clear errors
    document.getElementById("login-error").classList.add("hidden");
    document.getElementById("signup-error").classList.add("hidden");
    document.getElementById("signup-success").classList.add("hidden");
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    setLoading("btn-login", true);
    hideEl("login-error");

    try {
        const data = await supabaseLogin(email, password);

        if (data.error || data.error_description) {
            showError("login-error", data.error_description || data.msg || "Login failed");
            return;
        }

        accessToken = data.access_token;
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("user_email", email);
        navigate("dashboard");
    } catch (err) {
        showError("login-error", err.message);
    } finally {
        setLoading("btn-login", false);
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;

    setLoading("btn-signup", true);
    hideEl("signup-error");
    hideEl("signup-success");

    try {
        const data = await supabaseSignUp(email, password);

        if (data.error || data.error_description) {
            showError("signup-error", data.error_description || data.msg || "Signup failed");
            return;
        }

        showSuccess("signup-success", "Account created! Check your email to confirm, then login.");
    } catch (err) {
        showError("signup-error", err.message);
    } finally {
        setLoading("btn-signup", false);
    }
}

function logout() {
    accessToken = null;
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_email");
    navigate("auth");
}

// ══════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════

async function initDashboard() {
    const email = localStorage.getItem("user_email") || "";
    document.getElementById("user-email-display").textContent = email;

    // Check resume status
    try {
        const status = await apiFetch("/resume/status");
        if (status.has_resume) {
            document.getElementById("resume-status-text").textContent =
                `Resume: ${status.title || "Uploaded"}`;
            document.getElementById("resume-action-text").textContent = "Re-upload";
        } else {
            document.getElementById("resume-status-text").textContent = "No resume uploaded yet";
            document.getElementById("resume-action-text").textContent = "Upload";
        }
    } catch {
        document.getElementById("resume-status-text").textContent = "Could not check status";
    }

    // Check history
    try {
        const history = await apiFetch("/interview/history");
        document.getElementById("history-count-text").textContent =
            `${history.length} past session${history.length !== 1 ? "s" : ""}`;
    } catch {
        document.getElementById("history-count-text").textContent = "Could not load";
    }
}

// ══════════════════════════════════════════════
//  HISTORY
// ══════════════════════════════════════════════

async function loadHistory() {
    const list = document.getElementById("history-list");
    const listView = document.getElementById("history-list-view");
    const detailView = document.getElementById("history-detail-view");

    // Always show list view when loading
    listView.classList.remove("hidden");
    detailView.classList.add("hidden");

    list.innerHTML = '<div class="empty-state"><p style="animation: pulse 1.5s infinite">Loading sessions...</p></div>';

    try {
        const history = await apiFetch("/interview/history");

        if (history.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎤</div>
                    <p>No interview sessions yet.</p>
                    <p style="margin-top: 8px"><button class="btn btn-primary btn-sm" onclick="navigate('interview')">Start Your First Interview</button></p>
                </div>`;
        } else {
            list.innerHTML = history
                .map(
                    (s, i) => `
                <div class="history-item" onclick="loadSessionDetail('${s.session_id}')" style="animation-delay: ${i * 0.08}s">
                    <div class="history-item-info">
                        <h4>${escapeHtml(s.role)}</h4>
                        <p>${formatDate(s.created_at)} · ${s.message_count} messages</p>
                    </div>
                    <div class="history-item-stat">View Details</div>
                </div>`
                )
                .join("");
        }
    } catch (err) {
        list.innerHTML = `<div class="empty-state"><p>Failed to load: ${escapeHtml(err.message)}</p></div>`;
    }
}

async function loadSessionDetail(sessionId) {
    const listView = document.getElementById("history-list-view");
    const detailView = document.getElementById("history-detail-view");
    const qaList = document.getElementById("session-qa-list");

    listView.classList.add("hidden");
    detailView.classList.remove("hidden");

    qaList.innerHTML = '<div class="empty-state"><p style="animation: pulse 1.5s infinite">Loading session...</p></div>';

    try {
        const data = await apiFetch(`/interview/session/${sessionId}`);

        // Set header
        document.getElementById("session-detail-title").textContent = "Interview Session";
        document.getElementById("session-detail-role").textContent = data.role;
        document.getElementById("session-detail-date").textContent = formatDate(data.created_at);

        // Parse messages into Q&A pairs
        const messages = data.messages || [];
        const qaPairs = parseQAPairs(messages);

        if (qaPairs.length === 0) {
            qaList.innerHTML = '<div class="empty-state"><p>No Q&A found for this session.</p></div>';
            return;
        }

        qaList.innerHTML = qaPairs
            .map(
                (pair, i) => `
            <div class="qa-pair" style="animation-delay: ${i * 0.1}s">
                <div class="qa-question">
                    <span class="q-label">Question ${i + 1}</span>
                    <p>${escapeHtml(pair.question)}</p>
                </div>
                ${pair.answer ? `
                <div class="qa-answer">
                    <span class="a-label">Your Answer</span>
                    <p>${escapeHtml(pair.answer)}</p>
                </div>` : ''}
                ${pair.feedback ? `
                <div class="qa-feedback">
                    <span class="f-label">AI Feedback</span>
                    <p>${escapeHtml(pair.feedback)}</p>
                </div>` : ''}
            </div>`
            )
            .join("");
    } catch (err) {
        qaList.innerHTML = `<div class="empty-state"><p>Failed to load: ${escapeHtml(err.message)}</p></div>`;
    }
}

function parseQAPairs(messages) {
    /**
     * Messages come in order:
     *   ai (question), ai (question), ...    ← initial batch of questions
     *   user (answer), ai (feedback),        ← per-question answer + eval
     *   user (answer), ai (feedback), ...
     *
     * We collect initial AI messages as questions,
     * then pair user answers with AI feedback.
     */
    const pairs = [];
    let i = 0;

    // Collect initial AI questions
    const questions = [];
    while (i < messages.length && messages[i].sender === "ai") {
        // Check if this looks like a feedback (starts with "Score:")
        if (messages[i].message.startsWith("Score:")) break;
        questions.push(messages[i].message);
        i++;
    }

    // Now pair remaining messages: user answer → AI feedback
    let qIdx = 0;
    while (i < messages.length && qIdx < questions.length) {
        const pair = { question: questions[qIdx] };

        if (i < messages.length && messages[i].sender === "user") {
            pair.answer = messages[i].message;
            i++;
        }

        if (i < messages.length && messages[i].sender === "ai") {
            pair.feedback = messages[i].message;
            i++;
        }

        pairs.push(pair);
        qIdx++;
    }

    // Add remaining unanswered questions
    while (qIdx < questions.length) {
        pairs.push({ question: questions[qIdx], answer: null, feedback: null });
        qIdx++;
    }

    return pairs;
}

function backToHistoryList() {
    document.getElementById("history-list-view").classList.remove("hidden");
    document.getElementById("history-detail-view").classList.add("hidden");
}

// ══════════════════════════════════════════════
//  RESUME UPLOAD
// ══════════════════════════════════════════════

// Drag & drop
(function initDragDrop() {
    document.addEventListener("DOMContentLoaded", () => {
        const zone = document.getElementById("upload-zone");
        if (!zone) return;

        zone.addEventListener("dragover", (e) => {
            e.preventDefault();
            zone.classList.add("drag-over");
        });

        zone.addEventListener("dragleave", () => {
            zone.classList.remove("drag-over");
        });

        zone.addEventListener("drop", (e) => {
            e.preventDefault();
            zone.classList.remove("drag-over");
            const file = e.dataTransfer.files[0];
            if (file) uploadResume(file);
        });
    });
})();

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) uploadResume(file);
}

async function uploadResume(file) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
        toast("Please upload a PDF file", "error");
        return;
    }

    const zone = document.getElementById("upload-zone");
    const progress = document.getElementById("upload-progress");
    const result = document.getElementById("upload-result");

    zone.classList.add("hidden");
    progress.classList.remove("hidden");
    result.classList.add("hidden");

    // Simulate progress
    const fill = document.getElementById("upload-progress-fill");
    const statusText = document.getElementById("upload-status-text");
    fill.style.width = "20%";
    statusText.textContent = "Uploading PDF...";

    const formData = new FormData();
    formData.append("file", file);

    try {
        fill.style.width = "50%";
        statusText.textContent = "Extracting text & generating embeddings...";

        const data = await fetch(`${API}/resume/upload`, {
            method: "POST",
            headers: authHeaders(),
            body: formData,
        });

        if (!data.ok) {
            const err = await data.json().catch(() => ({}));
            throw new Error(err.detail || "Upload failed");
        }

        const json = await data.json();

        fill.style.width = "100%";
        statusText.textContent = "Done!";

        setTimeout(() => {
            progress.classList.add("hidden");
            result.classList.remove("hidden");
            document.getElementById("upload-result-text").textContent =
                `Processed ${json.chunk_count} chunks from your resume. You're ready to start an interview!`;
        }, 500);
    } catch (err) {
        progress.classList.add("hidden");
        zone.classList.remove("hidden");
        toast("Upload failed: " + err.message, "error");
    }
}

// ══════════════════════════════════════════════
//  INTERVIEW
// ══════════════════════════════════════════════

async function startInterview() {
    const jobRole = document.getElementById("job-role-input").value.trim();
    const numQuestions = parseInt(document.getElementById("num-questions-input").value);

    if (!jobRole) {
        showError("interview-error", "Please enter a target job role");
        return;
    }

    setLoading("btn-start-interview", true);
    hideEl("interview-error");

    try {
        const data = await apiFetch("/interview/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: jobRole, num_questions: numQuestions }),
        });

        interviewState = {
            sessionId: data.session_id,
            questions: data.questions,
            currentIndex: 0,
            scores: [],
        };

        document.getElementById("interview-setup").classList.add("hidden");
        document.getElementById("interview-live").classList.remove("hidden");
        document.getElementById("interview-complete").classList.add("hidden");
        showCurrentQuestion();
    } catch (err) {
        showError("interview-error", err.message);
    } finally {
        setLoading("btn-start-interview", false);
    }
}

function showCurrentQuestion() {
    const q = interviewState.questions[interviewState.currentIndex];
    const total = interviewState.questions.length;
    const idx = interviewState.currentIndex + 1;

    document.getElementById("question-counter").textContent = `Question ${idx} / ${total}`;
    document.getElementById("interview-progress-fill").style.width =
        `${(idx / total) * 100}%`;
    document.getElementById("current-question-text").textContent = q.question;
    document.getElementById("answer-textarea").value = "";

    // Reset feedback
    document.getElementById("feedback-section").classList.add("hidden");
    document.getElementById("btn-submit-answer").classList.remove("hidden");
    document.getElementById("answer-textarea").disabled = false;
}

async function submitAnswer() {
    const answer = document.getElementById("answer-textarea").value.trim();
    if (!answer) {
        toast("Please type an answer first", "error");
        return;
    }

    const q = interviewState.questions[interviewState.currentIndex];

    setLoading("btn-submit-answer", true);
    document.getElementById("answer-textarea").disabled = true;

    try {
        const data = await apiFetch("/interview/answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                session_id: interviewState.sessionId,
                question: q.question,
                answer,
            }),
        });

        interviewState.scores.push(data.score);

        // Show feedback
        document.getElementById("score-badge").textContent = data.score;

        // Color the score
        const badge = document.getElementById("score-badge");
        if (data.score >= 7) {
            badge.style.background = "linear-gradient(135deg, #10b981, #06b6d4)";
        } else if (data.score >= 4) {
            badge.style.background = "linear-gradient(135deg, #f59e0b, #fb923c)";
        } else {
            badge.style.background = "linear-gradient(135deg, #ef4444, #f97316)";
        }
        badge.style.webkitBackgroundClip = "text";
        badge.style.webkitTextFillColor = "transparent";
        badge.style.backgroundClip = "text";

        document.getElementById("feedback-text").textContent = data.feedback;
        document.getElementById("improvement-text").textContent = data.improvement;

        document.getElementById("feedback-section").classList.remove("hidden");
        document.getElementById("btn-submit-answer").classList.add("hidden");

        // Update next button text
        const isLast = interviewState.currentIndex >= interviewState.questions.length - 1;
        document.getElementById("btn-next-question").textContent = isLast
            ? "Finish Interview"
            : "Next Question →";
    } catch (err) {
        toast("Error: " + err.message, "error");
        document.getElementById("answer-textarea").disabled = false;
    } finally {
        setLoading("btn-submit-answer", false);
    }
}

function nextQuestion() {
    interviewState.currentIndex++;

    if (interviewState.currentIndex >= interviewState.questions.length) {
        // Interview complete
        document.getElementById("interview-live").classList.add("hidden");
        document.getElementById("interview-complete").classList.remove("hidden");

        const avg =
            interviewState.scores.reduce((a, b) => a + b, 0) / interviewState.scores.length;
        document.getElementById("total-answered").textContent = interviewState.scores.length;
        document.getElementById("avg-score").textContent = avg.toFixed(1);
    } else {
        showCurrentQuestion();
    }
}

function resetInterview() {
    interviewState = { sessionId: null, questions: [], currentIndex: 0, scores: [] };
    document.getElementById("interview-setup").classList.remove("hidden");
    document.getElementById("interview-live").classList.add("hidden");
    document.getElementById("interview-complete").classList.add("hidden");
    document.getElementById("job-role-input").value = "";
    hideEl("interview-error");
}

// ══════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════

function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const text = btn.querySelector(".btn-text");
    const loader = btn.querySelector(".btn-loader");
    if (loading) {
        btn.disabled = true;
        if (text) text.classList.add("hidden");
        if (loader) loader.classList.remove("hidden");
    } else {
        btn.disabled = false;
        if (text) text.classList.remove("hidden");
        if (loader) loader.classList.add("hidden");
    }
}

function showError(elId, msg) {
    const el = document.getElementById(elId);
    if (el) {
        el.textContent = msg;
        el.classList.remove("hidden");
    }
}

function showSuccess(elId, msg) {
    const el = document.getElementById(elId);
    if (el) {
        el.textContent = msg;
        el.classList.remove("hidden");
    }
}

function hideEl(elId) {
    const el = document.getElementById(elId);
    if (el) el.classList.add("hidden");
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function toast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.textContent = message;
    container.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
//  LIVE ASSIST
// ══════════════════════════════════════════════

async function getLiveAnswer() {
    const question = document.getElementById("live-question-input").value.trim();
    const role = document.getElementById("live-role-input").value.trim();
    const level = document.getElementById("live-level-input").value;
    const errorEl = document.getElementById("live-error");
    const btn = document.getElementById("btn-live-answer");
    const responseDiv = document.getElementById("live-response");

    errorEl.classList.add("hidden");
    errorEl.textContent = "";

    if (!question) {
        errorEl.textContent = "Please enter a question.";
        errorEl.classList.remove("hidden");
        return;
    }

    // Loading state
    btn.disabled = true;
    btn.querySelector(".btn-text").textContent = "Generating...";
    btn.querySelector(".btn-loader").classList.remove("hidden");

    try {
        const data = await apiFetch("/interview/live-answer", {
            method: "POST",
            body: JSON.stringify({
                question,
                role,
                level,
                history: liveSessionHistory // Send full session history
            }),
        });

        // Store Q&A pair in history
        if (data.answer) {
            liveSessionHistory.push({
                question: question,
                answer: data.answer
            });
        }

        // Display answer and detected level
        const levelDisplay = data.detected_level ? ` • ${data.detected_level.toUpperCase()}` : "";
        document.querySelector(".question-label").textContent = `Your Answer${levelDisplay}`;
        document.getElementById("live-answer-text").textContent = data.answer || "No answer generated.";

        // Display code block (if coding question)
        const codeSection = document.getElementById("live-code-section");
        if (data.code) {
            document.getElementById("live-code-text").textContent = data.code;
            document.getElementById("live-code-lang").textContent = (data.code_language || "code").toUpperCase();
            codeSection.classList.remove("hidden");
        } else {
            codeSection.classList.add("hidden");
        }

        // Display key points
        const kpList = document.getElementById("live-key-points");
        kpList.innerHTML = "";
        (data.key_points || []).forEach((point) => {
            const li = document.createElement("li");
            li.textContent = point;
            kpList.appendChild(li);
        });

        // Display tip
        document.getElementById("live-tip").textContent = data.tip || "";

        responseDiv.classList.remove("hidden");
        responseDiv.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
        errorEl.textContent = err.message || "Failed to generate answer.";
        errorEl.classList.remove("hidden");
    } finally {
        btn.disabled = false;
        btn.querySelector(".btn-text").textContent = "⚡ Get Instant Answer";
        btn.querySelector(".btn-loader").classList.add("hidden");
    }
}

function copyLiveAnswer() {
    const text = document.getElementById("live-answer-text").textContent;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById("btn-copy-answer");
        btn.textContent = "✅ Copied!";
        setTimeout(() => (btn.textContent = "📋 Copy"), 2000);
    });
}

function copyLiveCode() {
    const code = document.getElementById("live-code-text").textContent;
    navigator.clipboard.writeText(code).then(() => {
        showToast("Code copied to clipboard!");
    });
}

// Ctrl+Enter shortcut on the question textarea
document.addEventListener("DOMContentLoaded", () => {
    const textarea = document.getElementById("live-question-input");
    if (textarea) {
        textarea.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                getLiveAnswer();
            }
        });
    }
});

// ══════════════════════════════════════════════
//  BOOTSTRAP
// ══════════════════════════════════════════════

(function init() {
    if (accessToken) {
        navigate("dashboard");
    } else {
        navigate("auth");
    }
})();
