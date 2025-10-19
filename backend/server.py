from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.endpoints.businesses import router as business_router
from api.endpoints.reviews import router as reviews_router

app = FastAPI()

origins = ["http://localhost:8080"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(business_router, prefix="/api/v1", tags=["businesses"])
app.include_router(reviews_router, prefix="/api/v1", tags=["reviews"])

@app.get("/")
async def root():
    return {"message": "Hello World"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=3000)