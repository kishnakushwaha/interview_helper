from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, interview, resume

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

@app.get("/")
def root():
    return {"message": "DesierAI backend running"}
