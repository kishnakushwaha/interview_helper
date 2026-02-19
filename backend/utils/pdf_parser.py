"""Utility to extract and chunk text from PDF files."""

from PyPDF2 import PdfReader
import io


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract all text from a PDF given its raw bytes."""
    reader = PdfReader(io.BytesIO(file_bytes))
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text.strip())
    return "\n\n".join(pages)


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks for embedding / RAG."""
    words = text.split()
    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if chunk:
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks