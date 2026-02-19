"""Groq LLM service – generates interview questions and evaluates answers."""

import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise Exception("GROQ_API_KEY missing in .env")

client = Groq(api_key=GROQ_API_KEY)
MODEL = "llama-3.3-70b-versatile"


def generate_interview_questions(
    resume_context: str,
    job_role: str,
    num_questions: int = 5,
) -> list[dict]:
    """Ask Groq to generate interview questions based on resume + role."""
    prompt = f"""You are a senior technical interviewer.
Based on the candidate's resume and the target job role, generate exactly {num_questions} interview questions.

Resume context:
\"\"\"
{resume_context}
\"\"\"

Target job role: {job_role}

Return a JSON array of objects with keys "id" (1-indexed int) and "question" (string).
Return ONLY the JSON array, no markdown fences, no extra text."""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=2048,
    )

    raw = response.choices[0].message.content.strip()
    # Strip markdown fences if model adds them
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        raw = raw.rsplit("```", 1)[0]
    return json.loads(raw)


def evaluate_answer(
    question: str,
    answer: str,
    resume_context: str,
) -> dict:
    """Ask Groq to evaluate an interview answer."""
    prompt = f"""You are a senior technical interviewer evaluating a candidate's answer.

Question: {question}

Candidate's Answer: {answer}

Resume Context (for reference):
\"\"\"
{resume_context}
\"\"\"

Evaluate the answer. Return a JSON object with these keys:
- "score": integer 1-10
- "feedback": a 2-3 sentence evaluation
- "improvement": a concise suggestion for a better answer

Return ONLY the JSON object, no markdown fences, no extra text."""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        max_tokens=1024,
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        raw = raw.rsplit("```", 1)[0]
    return json.loads(raw)


def generate_live_answer(
    question: str,
    resume_context: str,
    job_role: str = "",
    level: str = "",
    history: list = None,
) -> dict:
    """Generate a real-time answer with session memory and auto level detection."""
    role_hint = f"\nTarget Role: {job_role}" if job_role else ""
    level_hint = f"\nCandidate-specified level: {level}" if level else ""

    # Build conversation history block
    history_block = ""
    if history:
        history_block = "\n\n── Interview so far (Most recent first) ──\n"
        # Use last 20 questions for deep context (Llama-3 has 128k context)
        for i, turn in enumerate(history[-20:], 1):
            q = turn.get("question", "")
            a = turn.get("answer", "")
            history_block += f"Q{i}: {q}\nA{i}: {a}\n\n"

    prompt = f"""You are a brilliant interview coach sitting RIGHT BESIDE the candidate during a live interview.
You can see everything. You are their "second brain" — calm, razor-sharp, and highly contextual.

Your goal: Provide the PERFECT instantaneous answer to the current question, considering the entire conversation flow.
{role_hint}{level_hint}

Resume:
\"\"\"
{resume_context}
\"\"\"
{history_block}
CURRENT QUESTION: {question}

---
CRITICAL INSTRUCTIONS FOR "HUMAN-LIKE" CONTEXT:
1. **Analyze the Trajectory**: Look at the previous Q&As. Is the interviewer digging deeper into a specific topic? Are they testing edge cases?
2. **Handle References**: If the question is "Can you optimize that?" or "Why did you use X?", REFER BACK to your previous answer immediately.
   - Example: "As I used a hash map in the previous solution, we can optimize space by..."
   - Do NOT say "I don't know what you're referring to". You have the history. Use it.
3. **Consistency**: Ensure your new answer doesn't contradict your previous ones. Build upon them.
4. **Auto-Detect Level**:
   - Simple Q → Junior/Direct answer
   - Complex/Abstract Q → Senior/Nuanced answer

STYLE GUIDELINES (MANDATORY):
- **Spoken Word ONLY**: Write exactly what the candidate should SAY. No "As I reflect..." or "In the context of...".
- **Natural Flow**: Use "Well," "So," "Actually," to sound authentic.
- **Concise Hints**: If the answer is long, give the *core concept* first, then details.
- **No Essay Speak**: Avoid words like "Furthermore", "Moreover", "Consequently".
- **Wingman Mode**: If the user is stuck, give them a lifeline ("You can mention X, Y, and Z").
---

OUTPUT FORMAT (JSON ONLY):
{{
  "answer": "A natural, conversational script (2-4 sentences). strict spoken English.",
  "key_points": ["Talking point 1", "Talking point 2"],
  "tip": "Delivery advice (tone/speed/posture)",
  "code": "Clean code snippet (if coding Q)",
  "code_language": "python/js/sql/etc",
  "detected_level": "easy/medium/hard"
}}"""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3, # Low temp for factual consistency
        max_tokens=2048,
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        raw = raw.rsplit("```", 1)[0]
    return json.loads(raw)



