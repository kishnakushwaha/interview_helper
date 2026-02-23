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
MODEL = "llama-3.1-8b-instant"


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
    # Strip markdown fences
    if "```json" in raw:
        raw = raw.split("```json")[1].split("```")[0].strip()
    elif "```" in raw:
        raw = raw.split("```")[1].split("```")[0].strip()
    
    return json.loads(raw, strict=False)


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
    # Strip markdown fences
    if "```json" in raw:
        raw = raw.split("```json")[1].split("```")[0].strip()
    elif "```" in raw:
        raw = raw.split("```")[1].split("```")[0].strip()
    
    return json.loads(raw, strict=False)


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
        # Use last 3 questions for brief context to ensure low latency and save tokens
        for i, turn in enumerate(history[-3:], 1):
            q = turn.get("question", "")
            a = turn.get("answer", "")
            history_block += f"Q{i}: {q}\nA{i}: {a}\n\n"

    prompt = f"""You are a stealthy, highly technical AI assistant secretly helping a candidate during a live interview.
Your absolute only purpose is to provide direct, factual, technical answers to interview questions and Provide the PERFECT instantaneous answer to the current question, considering the entire conversation flow.
{role_hint}{level_hint}

Resume:
\"\"\"
{resume_context}
\"\"\"
{history_block}
CURRENT QUESTION/AUDIO FRAGMENT: {question}

---
CRITICAL INSTRUCTIONS FOR LIVE DICTATION:
1. **IGNORE HALLUCINATIONS**: Speech-to-text engines often hallucinate during silence. If the input is conversational filler (e.g., "Well, I'm ready", "I'm listening", "Thank you", "Hello", "How are you"), you MUST return an empty string for the answer. Do NOT reply conversationally.
2. **ZERO CONVERSATION**: You are NOT a conversational chatbot. You are a technical knowledge base. Never say "Hello," "I'd be happy to explain," or "Great question." Start your answer immediately with the technical facts.
3. **DIRECT & CONCISE**: Give the answer directly. No fluff. Write exactly what the candidate should say to sound like a senior engineer. 
4. **Detect Incomplete Input**: If the question seems cut off mid-sentence, return "Waiting for interviewer to finish..." instead of trying to guess the answer.
5. **No Hallucinated Experience**: Do NOT make up stories unless explicitly stated in the Resume.

OUTPUT FORMAT (JSON ONLY):
{{
  "answer": "Direct technical answer, no greeting or conversational filler. (Or empty string if hallucination)",
  "key_points": ["Technical point 1", "Technical point 2"],
  "tip": "Short delivery advice",
  "code": "Code snippet if applicable",
  "code_language": "python/js/etc",
  "detected_level": "easy/medium/hard"
}}"""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3, # Low temp for factual consistency
        max_tokens=2048,
    )

    raw = response.choices[0].message.content.strip()
    # Strip markdown fences
    if "```json" in raw:
        raw = raw.split("```json")[1].split("```")[0].strip()
    elif "```" in raw:
        raw = raw.split("```")[1].split("```")[0].strip()
    
    return json.loads(raw, strict=False)
