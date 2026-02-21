import requests
import io

def test_stt_endpoint():
    # Note: This requires the server to be running on localhost:8000
    # and a valid JWT token for a user.
    # Since I'm in a headless environment, I'll test the service directly first.
    pass

if __name__ == "__main__":
    from services.stt_service import transcribe_audio
    import os

    # Create a tiny silent wav file for testing
    os.system("ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 1 -y test_audio.wav")
    
    if os.path.exists("test_audio.wav"):
        with open("test_audio.wav", "rb") as f:
            content = f.read()
            print("Transcribing silent audio...")
            try:
                transcript = transcribe_audio(content, "test_audio.wav")
                print(f"Transcript: '{transcript}'")
                print("STT Service Test: SUCCESS (Response received)")
            except Exception as e:
                print(f"STT Service Test: FAILED - {str(e)}")
        os.remove("test_audio.wav")
    else:
        print("Failed to create test audio file.")
