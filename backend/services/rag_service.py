"""RAG service – store and retrieve resume data via Supabase.

Tables used:
  - resumes (id, user_id, title, file_url, parsed_text, created_at)
  - resume_embeddings (id, resume_id, content_chunk, embedding[vector], created_at)
"""

import json
from db.supabase_client import supabase


# ── Resumes table ───────────────────────────────

def create_resume_record(user_id: str, title: str, parsed_text: str) -> str:
    """Create a resume record and return its id."""
    # Delete previous resumes for this user (keep latest only)
    old = (
        supabase.table("resumes")
        .select("id")
        .eq("user_id", user_id)
        .execute()
    )
    if old.data:
        for row in old.data:
            supabase.table("resume_embeddings").delete().eq("resume_id", row["id"]).execute()
            supabase.table("resumes").delete().eq("id", row["id"]).execute()

    result = (
        supabase.table("resumes")
        .insert({
            "user_id": user_id,
            "title": title,
            "parsed_text": parsed_text,
        })
        .execute()
    )
    return result.data[0]["id"]


def get_user_resume(user_id: str) -> dict | None:
    """Get the current user's resume record, or None."""
    result = (
        supabase.table("resumes")
        .select("id, title, parsed_text")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


# ── Resume Embeddings table ─────────────────────

def store_resume_embeddings(
    resume_id: str,
    chunks: list[str],
    embeddings: list[list[float]],
) -> int:
    """Store resume text chunks and their embeddings."""
    rows = [
        {
            "resume_id": resume_id,
            "content_chunk": chunk,
            "embedding": json.dumps(emb),  # vector type accepts JSON string
        }
        for chunk, emb in zip(chunks, embeddings)
    ]

    # Insert in batches of 50
    batch_size = 50
    for i in range(0, len(rows), batch_size):
        supabase.table("resume_embeddings").insert(rows[i : i + batch_size]).execute()

    return len(rows)


def retrieve_relevant_chunks(
    resume_id: str,
    query: str,
    top_k: int = 3,
) -> list[str]:
    """Find the top-k most relevant resume chunks using TF-IDF similarity."""
    from services.embedding_service import compute_similarity

    response = (
        supabase.table("resume_embeddings")
        .select("content_chunk")
        .eq("resume_id", resume_id)
        .execute()
    )

    if not response.data:
        return []

    chunks = [row["content_chunk"] for row in response.data]
    sims = compute_similarity(query, chunks)

    # Pair, sort, return top-k
    scored = sorted(zip(sims, chunks), key=lambda x: x[0], reverse=True)
    return [text for _, text in scored[:top_k]]


def get_full_resume_text(user_id: str) -> tuple[str, str | None]:
    """Return (parsed_text, resume_id) for the user's latest resume."""
    resume = get_user_resume(user_id)
    if not resume:
        return "", None
    return resume.get("parsed_text", ""), resume["id"]
