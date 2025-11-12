from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from api.endpoints.businesses import router as business_router
from api.endpoints.locations import router as locations_router
from api.endpoints.analytics import router as analytics_router
from configs.settings import PROJECT_NAME, VERSION, ALLOWED_ORIGINS
from database.database import init_db, close_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifecycle manager for database connections.
    Runs on startup and shutdown.
    """
    # Startup: Initialize database tables (if needed)
    await init_db()
    yield
    # Shutdown: Close database connections
    await close_db()


app = FastAPI(
    title=PROJECT_NAME,
    description="API for analyzing Yelp business performance with visual analytics",
    version=VERSION,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(business_router, prefix="/api")
app.include_router(locations_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")


@app.get("/", tags=["health"])
def root():
    """Root endpoint - API health check"""
    return {"message": "Yelp Business Analytics API", "status": "healthy"}


@app.get("/health", tags=["health"])
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8080)