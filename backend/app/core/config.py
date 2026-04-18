import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, computed_field
from typing import List, Union

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8", 
        case_sensitive=True,
        extra="ignore"
    )

    PROJECT_NAME: str = "AI Language Tutor API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Assessment settings
    ASSESSMENT_TOTAL_QUESTIONS: int = 2

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"]
    
    # Database
    DATABASE_URL: str
    
    # Auth (Supabase JWT settings)
    SUPABASE_JWT_SECRET: str
    VITE_SUPABASE_URL: str
    VITE_SUPABASE_ANON_KEY: str
    
    # External APIs
    GROQ_API_KEY: str

    @computed_field
    @property
    def async_database_url(self) -> str:
        # Convert postgresql:// to postgresql+asyncpg://
        if self.DATABASE_URL.startswith("postgresql://"):
            return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif self.DATABASE_URL.startswith("postgres://"):
            return self.DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
        return self.DATABASE_URL

settings = Settings()
