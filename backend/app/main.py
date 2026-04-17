from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import assessments, chat, media, questions, leaderboard
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"], # This explicitly allows the Authorization header
        expose_headers=["*"],
    )

@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "version": settings.VERSION, "healthy": True}

# Include routing from api/routes
app.include_router(assessments.router, prefix=f"{settings.API_V1_STR}/assessments", tags=["Assessments"])
app.include_router(chat.router, prefix=f"{settings.API_V1_STR}/chat", tags=["Chat"])
app.include_router(media.router, prefix=f"{settings.API_V1_STR}", tags=["Media"])
app.include_router(questions.router, prefix=f"{settings.API_V1_STR}/questions", tags=["Questions"])
app.include_router(leaderboard.router, prefix=f"{settings.API_V1_STR}/leaderboard", tags=["Leaderboard"])

if __name__ == "__main__":
    import uvicorn
    # Local dev runner
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
