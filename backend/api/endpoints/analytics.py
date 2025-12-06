"""
Analytics API endpoints for time-series data.
Provides rating and sentiment timelines for businesses and geographic regions.
"""
from typing import Dict, Any, Optional, List
from datetime import date
import asyncio
from fastapi import APIRouter, Depends, Path, Query, HTTPException

from dependencies import (
    get_analytics_service, 
    get_forecast_service, 
    get_keyword_service,
    get_review_repository
)
from services.interfaces import AnalyticsServiceInterface
from services.forecast_service import ForecastService
from services.keyword_service import KeywordService
from repositories.interfaces import ReviewRepositoryInterface

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    responses={404: {"description": "Not found"}}
)


# ============================================================================
# Business Timeline Endpoints
# ============================================================================

@router.get("/business/{business_id}/combined-timeline", response_model=Dict[str, Any])
async def get_business_combined_timeline(
    business_id: str = Path(..., description="Business identifier"),
    period: str = Query('month', regex='^(day|week|month|year)$', description="Time period for aggregation"),
    start_date: Optional[date] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date filter (YYYY-MM-DD)"),
    category: Optional[str] = Query(None, description="Optional category for comparison (user-selected)"),
    analytics_service: AnalyticsServiceInterface = Depends(get_analytics_service)
):
    """
    Get combined ratings and sentiment timelines for a business with city and category comparisons.
    """
    business_ratings, business_sentiment = await asyncio.gather(
        analytics_service.get_business_ratings_timeline(
            business_id=business_id, period=period, start_date=start_date, end_date=end_date
        ),
        analytics_service.get_business_sentiment_timeline(
            business_id=business_id, period=period, start_date=start_date, end_date=end_date
        )
    )

    city_ratings = None
    city_sentiment = None
    category_ratings = None
    category_sentiment = None

    if business_ratings.get('city') and business_ratings.get('state'):
        city = business_ratings['city']
        state = business_ratings['state']
        
        city_ratings, city_sentiment = await asyncio.gather(
            analytics_service.get_city_ratings_timeline(
                city=city, state=state, period=period, start_date=start_date, end_date=end_date
            ),
            analytics_service.get_city_sentiment_timeline(
                city=city, state=state, period=period, start_date=start_date, end_date=end_date
            )
        )

    if category:
        category_city = business_ratings.get('city')
        category_state = business_ratings.get('state')
        category_ratings, category_sentiment = await asyncio.gather(
            analytics_service.get_category_ratings_timeline(
                category=category, city=category_city, state=category_state,
                period=period, start_date=start_date, end_date=end_date
            ),
            analytics_service.get_category_sentiment_timeline(
                category=category, city=category_city, state=category_state,
                period=period, start_date=start_date, end_date=end_date
            )
        )

    return {
        "business_ratings": business_ratings,
        "business_sentiment": business_sentiment,
        "city_ratings": city_ratings,
        "city_sentiment": city_sentiment,
        "category_ratings": category_ratings,
        "category_sentiment": category_sentiment
    }


# ============================================================================
# Geographic Timeline Endpoints
# ============================================================================

@router.get("/city/{state}/{city}/combined-timeline", response_model=Dict[str, Any])
async def get_city_combined_timeline(
    state: str = Path(..., min_length=2, max_length=2, description="State code (e.g., 'PA')"),
    city: str = Path(..., min_length=1, description="City name"),
    period: str = Query('month', regex='^(day|week|month|year)$', description="Time period for aggregation"),
    start_date: Optional[date] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date filter (YYYY-MM-DD)"),
    category: Optional[str] = Query(None, description="Optional category for comparison"),
    analytics_service: AnalyticsServiceInterface = Depends(get_analytics_service)
):
    """
    Get combined ratings and sentiment timelines for a city with optional category comparison.
    """
    city_ratings, city_sentiment = await asyncio.gather(
        analytics_service.get_city_ratings_timeline(
            city=city, state=state, period=period, start_date=start_date, end_date=end_date
        ),
        analytics_service.get_city_sentiment_timeline(
            city=city, state=state, period=period, start_date=start_date, end_date=end_date
        )
    )

    category_ratings = None
    category_sentiment = None

    if category:
        category_ratings, category_sentiment = await asyncio.gather(
            analytics_service.get_category_ratings_timeline(
                category=category, city=city, state=state,
                period=period, start_date=start_date, end_date=end_date
            ),
            analytics_service.get_category_sentiment_timeline(
                category=category, city=city, state=state,
                period=period, start_date=start_date, end_date=end_date
            )
        )

    return {
        "city_ratings": city_ratings,
        "city_sentiment": city_sentiment,
        "category_ratings": category_ratings,
        "category_sentiment": category_sentiment
    }


@router.get("/category/{category}/combined-timeline", response_model=Dict[str, Any])
async def get_category_combined_timeline(
    category: str = Path(..., min_length=1, description="Category name"),
    period: str = Query('month', regex='^(day|week|month|year)$', description="Time period for aggregation"),
    start_date: Optional[date] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date filter (YYYY-MM-DD)"),
    analytics_service: AnalyticsServiceInterface = Depends(get_analytics_service)
):
    """
    Get combined ratings and sentiment timelines for a category.
    """
    category_ratings, category_sentiment = await asyncio.gather(
        analytics_service.get_category_ratings_timeline(
            category=category, period=period, start_date=start_date, end_date=end_date
        ),
        analytics_service.get_category_sentiment_timeline(
            category=category, period=period, start_date=start_date, end_date=end_date
        )
    )

    return {
        "category_ratings": category_ratings,
        "category_sentiment": category_sentiment
    }


@router.get("/neighborhood/{state}/{city}/{neighborhood}/combined-timeline", response_model=Dict[str, Any])
async def get_neighborhood_combined_timeline(
    state: str = Path(..., min_length=2, max_length=2, description="State code (e.g., 'PA')"),
    city: str = Path(..., min_length=1, description="City name"),
    neighborhood: str = Path(..., min_length=1, description="Neighborhood name"),
    period: str = Query('month', regex='^(day|week|month|year)$', description="Time period for aggregation"),
    start_date: Optional[date] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date filter (YYYY-MM-DD)"),
    category: Optional[str] = Query(None, description="Optional category for comparison"),
    analytics_service: AnalyticsServiceInterface = Depends(get_analytics_service)
):
    """
    Get combined ratings and sentiment timelines for a neighborhood with optional category comparison.

    Reduces API calls by combining neighborhood ratings, neighborhood sentiment, and optional category data.
    """
    return await analytics_service.get_neighborhood_combined_timeline(
        neighborhood=neighborhood,
        city=city,
        state=state,
        period=period,
        start_date=start_date,
        end_date=end_date,
        category=category
    )


# ============================================================================
# Competitive Positioning Endpoints
# ============================================================================

@router.get("/competitive-snapshot", response_model=Dict[str, Any])
async def get_competitive_snapshot(
    city: Optional[str] = Query(None, description="Filter by city name"),
    state: Optional[str] = Query(None, min_length=2, max_length=2, description="Filter by state code (e.g., 'PA')"),
    neighborhood: Optional[str] = Query(None, description="Filter by neighborhood name"),
    category: Optional[str] = Query(None, description="Filter by category (partial match)"),
    business_id: Optional[str] = Query(None, description="Specific business to highlight"),
    analytics_service: AnalyticsServiceInterface = Depends(get_analytics_service)
):
    """
    Get competitive positioning snapshot for market analysis.

    Returns all businesses in the specified market (city/category) with pre-calculated
    statistics for competitive positioning visualization (scatter plots, quadrant analysis).

    **Use Case**: Competitive market positioning visualization (RQ2)
    - Show how a business compares to competitors in rating vs review volume space
    - Identify market leaders, hidden gems, and at-risk businesses
    - Provide actionable insights about competitive position

    **Filters** (at least one recommended):
    - `city` + `state`: All businesses in a city (e.g., Philadelphia, PA)
    - `category`: All businesses in a category (e.g., Restaurants)
    - Combine filters for precision (e.g., Restaurants in Philadelphia)

    **Performance**: Returns up to 5000 businesses with pre-calculated market statistics

    **Example Response:**
    ```json
    {
        "businesses": [
            {
                "business_id": "abc123",
                "name": "Joe's Pizza",
                "stars": 4.5,
                "review_count": 234,
                "city": "Philadelphia",
                "state": "PA",
                "categories": "Restaurants, Pizza, Italian",
                "is_open": 1
            }
        ],
        "statistics": {
            "avg_rating": 3.8,
            "median_review_count": 45,
            "total_businesses": 1234
        },
        "selected_business": {...},
        "filters": {
            "city": "Philadelphia",
            "state": "PA",
            "category": "Restaurants"
        }
    }
    ```
    """
    return await analytics_service.get_competitive_snapshot(
        city=city,
        state=state,
        neighborhood=neighborhood,
        category=category,
        business_id=business_id
    )


# ============================================================================
# Forecasting Endpoints
# ============================================================================

@router.get("/business/{business_id}/forecast", response_model=Dict[str, Any])
async def get_business_forecast(
    business_id: str = Path(..., description="Business identifier"),
    periods: int = Query(4, ge=1, le=12, description="Number of periods to forecast"),
    period_type: str = Query('month', regex='^(month|year)$', description="Period type for forecast"),
    analytics_service: AnalyticsServiceInterface = Depends(get_analytics_service),
    forecast_service: ForecastService = Depends(get_forecast_service)
):
    """
    Generate rating and sentiment forecasts for a business.

    Uses ARIMA modeling when sufficient data points exist (6+), 
    falls back to mean-based projection for sparse data.

    **Response:**
    - `rating_forecast`: Predicted ratings with 80% confidence bands
    - `sentiment_forecast`: Predicted sentiment scores with confidence bands
    - `model_type`: 'arima' or 'fallback' indicating method used
    """
    rating_timeline = await analytics_service.get_business_ratings_timeline(
        business_id=business_id,
        period=period_type
    )
    
    sentiment_timeline = await analytics_service.get_business_sentiment_timeline(
        business_id=business_id,
        period=period_type
    )
    
    # AnalyticsService returns data under 'data' key, not 'timeline'
    rating_data = rating_timeline.get('data', []) if rating_timeline else []
    sentiment_data = sentiment_timeline.get('data', []) if sentiment_timeline else []
    
    forecast_result = await forecast_service.generate_forecast(
        rating_timeline=rating_data,
        sentiment_timeline=sentiment_data,
        periods=periods,
        period_type=period_type
    )
    
    return forecast_result


# ============================================================================
# Period Issue Analysis Endpoints
# ============================================================================

@router.get("/business/{business_id}/period-issues", response_model=Dict[str, Any])
async def get_period_issues(
    business_id: str = Path(..., description="Business identifier"),
    start_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    n_clusters: int = Query(3, ge=1, le=10, description="Number of topic clusters per sentiment category"),
    review_repository: ReviewRepositoryInterface = Depends(get_review_repository),
    keyword_service: KeywordService = Depends(get_keyword_service)
):
    """
    Analyze issues in reviews for a specific time period.

    Splits reviews into negative/positive pools, then clusters each to find topic themes.

    **Response:**
    - `complaints`: Top n negative topic clusters (what went wrong)
    - `praises`: Top n positive topic clusters (what went right)
    - `negative_count`, `positive_count`: Review counts per category
    """
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must be before end_date")
    
    reviews = await review_repository.get_by_business_and_date_range(
        business_id=business_id,
        start_date=start_date,
        end_date=end_date
    )
    
    if not reviews:
        return {
            'complaints': [],
            'praises': [],
            'total_reviews': 0,
            'negative_count': 0,
            'positive_count': 0,
            'period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat()
            }
        }
    
    analysis_result = keyword_service.analyze_period(
        reviews=reviews,
        n_clusters=n_clusters
    )
    
    analysis_result['period'] = {
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat()
    }
    
    return analysis_result
