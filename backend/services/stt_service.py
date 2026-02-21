"""Groq STT service – transcribes audio files using Whisper."""

import os
import io
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise Exception("GROQ_API_KEY missing in .env")

client = Groq(api_key=GROQ_API_KEY)
MODEL = "whisper-large-v3" # Groq's best Whisper model

def transcribe_audio(file_content: bytes, filename: str = "audio.wav") -> str:
    """
    Transcribe audio bytes using Groq Whisper.
    Supports .mp3, .mp4, .mpeg, .mpga, .m4a, .wav, .webm
    """
    try:
        # Groq expects a file-like object with a name
        # We wrap the bytes in a BytesIO and give it a name attribute
        file_obj = io.BytesIO(file_content)
        file_obj.name = filename

        transcription = client.audio.transcriptions.create(
            file=file_obj,
            model=MODEL,
            response_format="json",
            language="en"
        )
        return transcription.text
    except Exception as e:
        print(f"Error in STT transcription: {str(e)}")
        raise e
