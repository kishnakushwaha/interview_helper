from fastapi import APIRouter, Depends
from utils.auth_dependency import get_current_user
from db.supabase_client import supabase

router = APIRouter()

@router.get("/me")
def get_user(user=Depends(get_current_user)):
    return {
        "user_id": user.get("sub"),
        "email": user.get("email")
    }

@router.get("/db-test")
def db_test(user=Depends(get_current_user)):
    response = supabase.table("resumes").select("*").limit(1).execute()
    return {
        "status": "DB connected",
        "data": response.data
    }