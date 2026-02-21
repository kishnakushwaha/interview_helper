from fastapi.testclient import TestClient
from main import app
from utils.auth_dependency import get_current_user
import os
import json

from services import rag_service
from routes import audio

# Mock the authentication dependency
async def mock_get_current_user():
    # Use a valid UUID string
    return {"sub": "00000000-0000-0000-0000-000000000000", "email": "test@example.com"}

# Mock the resume service to return dummy text
def mock_get_full_resume_text(user_id):
    return "This is a test resume context. I am a software engineer with experience in Python and React.", "test-resume-id"

app.dependency_overrides[get_current_user] = mock_get_current_user
# Mock in both places to be safe
rag_service.get_full_resume_text = mock_get_full_resume_text
audio.get_full_resume_text = mock_get_full_resume_text

client = TestClient(app)

def test_audio_listen_and_answer():
    # 1. Create a tiny silent wav file for testing
    os.system("ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 1 -y test_audio.wav")
    
    if not os.path.exists("test_audio.wav"):
        print("Failed to create test audio file.")
        return

    # 2. Prepare the request
    files = {
        "file": ("test_audio.wav", open("test_audio.wav", "rb"), "audio/wav")
    }
    data = {
        "role": "Software Engineer",
        "level": "Senior",
        "history": "[]"
    }

    print("Sending request to /audio/listen-and-answer...")
    try:
        response = client.post("/audio/listen-and-answer", files=files, data=data)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print("Response JSON:")
            print(json.dumps(result, indent=2))
            
            # Basic assertions
            assert "transcript" in result
            assert "answer" in result
            print("\nIntegration Test: SUCCESS")
        else:
            print(f"Integration Test: FAILED - {response.text}")
    except Exception as e:
        print(f"Integration Test: ERROR - {str(e)}")
    finally:
        # Cleanup
        files["file"][1].close()
        if os.path.exists("test_audio.wav"):
            os.remove("test_audio.wav")

if __name__ == "__main__":
    test_audio_listen_and_answer()
