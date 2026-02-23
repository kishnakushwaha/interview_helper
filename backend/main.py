from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, interview, resume, audio

app = FastAPI(title="DesierAI API")

# CORS – allow frontend dev server and common origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(resume.router, prefix="/resume", tags=["Resume"])
app.include_router(interview.router, prefix="/interview", tags=["Interview"])
app.include_router(audio.router, prefix="/audio", tags=["Audio"])

@app.get("/")
def root():
    return {"message": "DesierAI backend running"}

@app.get("/version")
def get_version():
    return {
        "latest_desktop_version": "1.1.0",
        "update_message": "A new version of DesierAI is available!",
        "download_url": "https://github.com/kishnakushwaha/interview_helper"
    }
