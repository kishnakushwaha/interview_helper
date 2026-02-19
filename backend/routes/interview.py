"""Interview routes – generate questions, evaluate answers, history.

Tables used:
  - interview_sessions (id, user_id, resume_id, role, created_at)
  - interview_messages  (id, session_id, sender, message, created_at)
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from utils.auth_dependency import get_current_user
from services.rag_service import get_full_resume_text, retrieve_relevant_chunks
from services.groq_service import generate_interview_questions, evaluate_answer, generate_live_answer
from db.supabase_client import supabase
from models.schemas import (
    InterviewStartRequest,
    InterviewStartResponse,
    InterviewQuestion,
    AnswerSubmitRequest,
    AnswerFeedback,
    InterviewSession,
)

router = APIRouter()


@router.post("/start", response_model=InterviewStartResponse)
def start_interview(
    req: InterviewStartRequest,
    user=Depends(get_current_user),
):
    """Generate interview questions based on the user's resume and target role."""
    user_id = user.get("sub")
    resume_text, resume_id = get_full_resume_text(user_id)

    if not resume_text or not resume_id:
        raise HTTPException(
            status_code=400,
            detail="No resume found. Please upload your resume first.",
        )

    try:
        questions_raw = generate_interview_questions(
            resume_context=resume_text,
            job_role=req.role,
            num_questions=req.num_questions,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate questions: {str(e)}",
        )

    session_id = str(uuid.uuid4())

    # Create interview session
    supabase.table("interview_sessions").insert(
        {
            "id": session_id,
            "user_id": user_id,
            "resume_id": resume_id,
            "role": req.role,
        }
    ).execute()

    # Store each question as an AI message
    for q in questions_raw:
        supabase.table("interview_messages").insert(
            {
                "session_id": session_id,
                "sender": "ai",
                "message": q["question"],
            }
        ).execute()

    questions = [InterviewQuestion(**q) for q in questions_raw]
    return InterviewStartResponse(session_id=session_id, questions=questions)


@router.post("/answer", response_model=AnswerFeedback)
def submit_answer(
    req: AnswerSubmitRequest,
    user=Depends(get_current_user),
):
    """Evaluate a single interview answer using the LLM."""
    user_id = user.get("sub")

    # Look up session to get resume_id
    session = (
        supabase.table("interview_sessions")
        .select("resume_id")
        .eq("id", req.session_id)
        .single()
        .execute()
    )

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    resume_id = session.data["resume_id"]

    # Retrieve relevant resume context for this question
    context_chunks = retrieve_relevant_chunks(resume_id, req.question, top_k=3)
    context = "\n\n".join(context_chunks) if context_chunks else ""

    # Store user's answer as a message
    supabase.table("interview_messages").insert(
        {
            "session_id": req.session_id,
            "sender": "user",
            "message": req.answer,
        }
    ).execute()

    try:
        result = evaluate_answer(
            question=req.question,
            answer=req.answer,
            resume_context=context,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to evaluate answer: {str(e)}",
        )

    # Store AI feedback as a message
    feedback_msg = f"Score: {result.get('score', 0)}/10\n\n{result.get('feedback', '')}\n\nImprovement: {result.get('improvement', '')}"
    supabase.table("interview_messages").insert(
        {
            "session_id": req.session_id,
            "sender": "ai",
            "message": feedback_msg,
        }
    ).execute()

    return AnswerFeedback(
        question=req.question,
        answer=req.answer,
        score=result.get("score", 0),
        feedback=result.get("feedback", ""),
        improvement=result.get("improvement", ""),
    )


@router.get("/history", response_model=list[InterviewSession])
def get_history(user=Depends(get_current_user)):
    """Retrieve past interview sessions for the current user."""
    user_id = user.get("sub")

    sessions = (
        supabase.table("interview_sessions")
        .select("id, role, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    if not sessions.data:
        return []

    result = []
    for s in sessions.data:
        messages = (
            supabase.table("interview_messages")
            .select("id")
            .eq("session_id", s["id"])
            .execute()
        )
        result.append(
            InterviewSession(
                session_id=s["id"],
                role=s["role"],
                created_at=s["created_at"],
                message_count=len(messages.data) if messages.data else 0,
            )
        )

    return result


@router.get("/session/{session_id}")
def get_session_detail(session_id: str, user=Depends(get_current_user)):
    """Retrieve all messages for a specific interview session."""
    user_id = user.get("sub")

    # Verify user owns this session
    session = (
        supabase.table("interview_sessions")
        .select("id, role, created_at")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get all messages ordered by creation time
    messages = (
        supabase.table("interview_messages")
        .select("sender, message, created_at")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )

    return {
        "session_id": session_id,
        "role": session.data["role"],
        "created_at": session.data["created_at"],
        "messages": messages.data or [],
    }


@router.post("/live-answer")
async def live_answer(
    request: Request,
    user=Depends(get_current_user),
):
    """Generate an instant AI answer with session memory and auto level detection."""
    user_id = user.get("sub")
    req = await request.json()
    question = req.get("question", "").strip()
    job_role = req.get("role", "").strip()
    level = req.get("level", "").strip()
    history = req.get("history", [])  # List of {question, answer} dicts

    if not question:
        raise HTTPException(status_code=400, detail="Question is required")

    resume_text, resume_id = get_full_resume_text(user_id)
    if not resume_text:
        raise HTTPException(
            status_code=400,
            detail="No resume found. Please upload your resume first.",
        )

    try:
        result = generate_live_answer(
            question=question,
            resume_context=resume_text,
            job_role=job_role,
            level=level,
            history=history,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate answer: {str(e)}",
        )

    return result


@router.get("/health")
def interview_health():
    return {"interview": "working"}
