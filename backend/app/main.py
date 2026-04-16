from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import assessments
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
        allow_headers=["*"],
    )

@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "version": settings.VERSION}

# Include routing from api/routes
app.include_router(assessments.router, prefix=f"{settings.API_V1_STR}/assessments", tags=["Assessments"])

if __name__ == "__main__":
    import uvicorn
    # Local dev runner
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
