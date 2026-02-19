"""Resume routes – upload PDF, parse, embed, and store.

Tables used:
  - resumes (id, user_id, title, file_url, parsed_text, created_at)
  - resume_embeddings (id, resume_id, content_chunk, embedding, created_at)
"""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from utils.auth_dependency import get_current_user
from utils.pdf_parser import extract_text_from_pdf, chunk_text
from services.embedding_service import get_embeddings
from services.rag_service import create_resume_record, store_resume_embeddings, get_user_resume
from models.schemas import ResumeUploadResponse, ResumeStatus

router = APIRouter()


@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    """Upload a PDF resume, extract text, generate embeddings, and store."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user token")

    try:
        contents = await file.read()
        text = extract_text_from_pdf(contents)

        if not text.strip():
            raise HTTPException(
                status_code=400,
                detail="Could not extract text from PDF. Is it scanned/image-only?",
            )

        # 1. Create resume record
        title = file.filename.rsplit(".", 1)[0]  # filename without .pdf
        resume_id = create_resume_record(user_id, title, text)

        # 2. Chunk + embed + store
        chunks = chunk_text(text)
        embeddings = get_embeddings(chunks)
        count = store_resume_embeddings(resume_id, chunks, embeddings)

        return ResumeUploadResponse(
            message="Resume uploaded and processed successfully",
            resume_id=resume_id,
            chunk_count=count,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@router.get("/status", response_model=ResumeStatus)
def resume_status(user=Depends(get_current_user)):
    """Check whether the current user has uploaded a resume."""
    user_id = user.get("sub")
    resume = get_user_resume(user_id)
    if resume:
        return ResumeStatus(has_resume=True, resume_id=resume["id"], title=resume.get("title"))
    return ResumeStatus(has_resume=False)


@router.get("/health")
def resume_health():
    return {"resume": "working"}
