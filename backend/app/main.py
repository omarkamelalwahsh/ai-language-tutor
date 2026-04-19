import logging
import traceback
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import assessments, chat, media, questions, leaderboard, learner, auth
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Global logging config
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"GLOBAL ERROR: {str(exc)}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": "Critical Internal Server Error", "error": str(exc)},
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
app.include_router(learner.router, prefix=f"{settings.API_V1_STR}/learner", tags=["Learner"])
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])

if __name__ == "__main__":
    import uvicorn
    print(f"Starting server with settings: {settings.PROJECT_NAME} v{settings.VERSION}")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
