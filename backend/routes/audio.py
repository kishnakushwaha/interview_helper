from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from utils.auth_dependency import get_current_user
from services.stt_service import transcribe_audio
from services.groq_service import generate_live_answer
from services.rag_service import get_full_resume_text

router = APIRouter()

@router.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    user=Depends(get_current_user)
):
    """Simple transcription endpoint."""
    try:
        content = await file.read()
        transcript = transcribe_audio(content, file.filename)
        return {"transcript": transcript}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/listen-and-answer")
async def listen_and_answer(
    file: UploadFile = File(...),
    role: str = "",
    level: str = "",
    history: str = "[]", # JSON string from client
    user=Depends(get_current_user)
):
    """Transcribe audio and generate an AI answer in one go."""
    user_id = user.get("sub")
    
    try:
        import json
        history_list = json.loads(history)
    except Exception:
        history_list = []

    try:
        # 1. Transcribe the audio
        content = await file.read()
        if len(content) < 100:
            return {"transcript": "", "answer": "Recording was too short or empty. Please try speaking again."}
            
        transcript = transcribe_audio(content, file.filename)
        
        # Whisper Silence Hallucination Filter
        t_clean = transcript.lower().strip()
        hallucinations = [
            "thank you.", "okay.", "bye.", "you.", "yeah.", "yes.", 
            "thank you", "okay", "bye", "you", "yeah", "yes", "amém.", "amén",
            "hello.", "hello", "hi.", "hi", "i'm sorry.", "sorry."
        ]
        
        if t_clean in hallucinations or len(t_clean) < 3:
            transcript = "" # Treat as complete silence to prevent UI overwrite
            
        if not transcript.strip():
            return {"transcript": "", "answer": ""}

        # 2. Get resume context
        resume_text, _ = get_full_resume_text(user_id)
        if not resume_text:
             raise HTTPException(status_code=400, detail="No resume found.")

        # 3. Generate live answer
        result = generate_live_answer(
            question=transcript,
            resume_context=resume_text,
            job_role=role,
            level=level,
            history=history_list
        )
        
        return {
            "transcript": transcript,
            **result
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        import logging
        logging.error(f"Error in listen-and-answer: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
