"""
Application configuration settings.
"""
import os
from pathlib import Path

# Base directory of the backend
BASE_DIR = Path(__file__).resolve().parent.parent

# Data directory for JSON mock database
DATA_DIR = BASE_DIR / "data"

# JSON file paths
BUSINESSES_JSON = DATA_DIR / "subset_businesses.json"
PHOTOS_JSON = DATA_DIR / "subset_photos.json"
REVIEWS_JSON = DATA_DIR / "reviews_with_sentiment.json"
SUMMARY_JSON = DATA_DIR / "subset_summary.json"

# API Configuration
API_V1_PREFIX = "/api/v1"
PROJECT_NAME = "Yelp Business Analytics API"
VERSION = "1.0.0"

# CORS Configuration
ALLOWED_ORIGINS = [
    "http://localhost:8080",
    "http://localhost:3000",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:3000",
]

# Database mode (for future migration)
USE_JSON_DATABASE = True  # Set to False when migrating to real database