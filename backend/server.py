from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager

from api.endpoints.businesses import router as business_router
from api.endpoints.locations import router as locations_router
from api.endpoints.analytics import router as analytics_router
from configs.settings import PROJECT_NAME, VERSION, ALLOWED_ORIGINS
from database.database import init_db, close_db
from dependencies import preload_ml_models


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    preload_ml_models()
    yield
    await close_db()


app = FastAPI(
    title=PROJECT_NAME,
    description="API for analyzing  business performance with visual analytics",
    version=VERSION,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Add GZip compression for responses > 1KB (reduces bandwidth)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Register routers
app.include_router(business_router, prefix="/api")
app.include_router(locations_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")


@app.get("/", tags=["health"])
def root():
    """Root endpoint - API health check"""
    return {"message": " Business Analytics API", "status": "healthy"}


@app.get("/health", tags=["health"])
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8080)