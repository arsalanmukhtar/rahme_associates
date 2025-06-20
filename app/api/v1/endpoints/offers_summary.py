from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.database import get_db
from app.api.v1.endpoints.users import get_current_user
from app.schemas.user import UserInDB
from fastapi import status
from sqlalchemy import text

router = APIRouter()

@router.get("/offers-summary", summary="Get offers summary for current user")
async def get_offers_summary(
    current_user: UserInDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        # Query the offers_summary view/table filtered by user_id
        sql = text("SELECT * FROM public.offers_summary WHERE user_id = :user_id")
        result = db.execute(sql, {"user_id": current_user.id})
        offers = [dict(row) for row in result]
        return offers
    except Exception as e:
        print("Error fetching offers summary:", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch offers summary")
