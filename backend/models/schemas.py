from pydantic import BaseModel
from typing import Optional


# ── Resume ──────────────────────────────────────
class ResumeUploadResponse(BaseModel):
    message: str
    resume_id: str
    chunk_count: int


class ResumeStatus(BaseModel):
    has_resume: bool
    resume_id: Optional[str] = None
    title: Optional[str] = None


# ── Interview ──────────────────────────────────
class InterviewStartRequest(BaseModel):
    role: str
    num_questions: int = 5


class InterviewQuestion(BaseModel):
    id: int
    question: str


class InterviewStartResponse(BaseModel):
    session_id: str
    questions: list[InterviewQuestion]


class AnswerSubmitRequest(BaseModel):
    session_id: str
    question: str
    answer: str


class AnswerFeedback(BaseModel):
    question: str
    answer: str
    score: int  # 1-10
    feedback: str
    improvement: str


class InterviewSession(BaseModel):
    session_id: str
    role: str
    created_at: str
    message_count: int
