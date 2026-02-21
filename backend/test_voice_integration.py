import os
import json
from fastapi.testclient import TestClient
from main import app
from utils.auth_dependency import get_current_user
from services import rag_service
from routes import audio

# 1. Setup Mocks
async def mock_get_current_user():
    return {"sub": "00000000-0000-0000-0000-000000000000", "email": "test@example.com"}

def mock_get_full_resume_text(user_id):
    return "I am a Senior Software Engineer with 10 years of experience in Python, Distributed Systems, and AI.", "test-resume-id"

app.dependency_overrides[get_current_user] = mock_get_current_user
rag_service.get_full_resume_text = mock_get_full_resume_text
audio.get_full_resume_text = mock_get_full_resume_text

client = TestClient(app)

def run_voice_test():
    print("🎤 Generating test voice file using macOS 'say'...")
    test_text = "Hello, can you explain how you would design a scalable rate limiting service?"
    os.system(f"say -o voice_input.aiff '{test_text}'")
    
    # Convert AIFF (macOS default) to WAV for Whisper compatibility
    os.system("ffmpeg -i voice_input.aiff -y voice_input.wav > /dev/null 2>&1")
    
    if not os.path.exists("voice_input.wav"):
        print("❌ Failed to generate voice file.")
        return

    print(f"📡 Sending voice request: \"{test_text}\"")
    
    files = {
        "file": ("voice_input.wav", open("voice_input.wav", "rb"), "audio/wav")
    }
    data = {
        "role": "Senior Software Engineer",
        "level": "Hard",
        "history": "[]"
    }

    try:
        response = client.post("/audio/listen-and-answer", files=files, data=data)
        if response.status_code == 200:
            result = response.json()
            print("\n✅ TEST SUCCESSFUL")
            print(f"👂 Transcript: \"{result['transcript']}\"")
            print(f"🤖 AI Answer: {result['answer']}")
            print(f"💡 Key Points: {', '.join(result['key_points'])}")
        else:
            print(f"❌ TEST FAILED: {response.status_code}")
            print(response.text)
    finally:
        files["file"][1].close()
        if os.path.exists("voice_input.aiff"): os.remove("voice_input.aiff")
        if os.path.exists("voice_input.wav"): os.remove("voice_input.wav")

if __name__ == "__main__":
    run_voice_test()
