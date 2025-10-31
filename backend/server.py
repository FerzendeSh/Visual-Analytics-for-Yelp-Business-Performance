from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.endpoints.businesses import router as business_router
from api.endpoints.reviews import router as reviews_router
from api.endpoints.photos import router as photos_router
from configs.settings import PROJECT_NAME, VERSION, ALLOWED_ORIGINS

app = FastAPI(
    title=PROJECT_NAME,
    description="API for analyzing Yelp business performance with visual analytics",
    version=VERSION
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

#  routers
app.include_router(business_router, prefix="/api/v1")
app.include_router(reviews_router, prefix="/api/v1")
app.include_router(photos_router, prefix="/api/v1")


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
    uvicorn.run(app, host="127.0.0.1", port=3000)