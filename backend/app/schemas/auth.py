from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Optional

class UserMe(BaseModel):
    id: UUID
    email: EmailStr
    full_name: Optional[str] = None
    is_onboarded: bool
    native_language: Optional[str] = None
    target_level: Optional[str] = None

    class Config:
        from_attributes = True
