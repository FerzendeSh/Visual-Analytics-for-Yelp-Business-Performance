"""
Analytics API endpoints for time-series data.
Provides rating and sentiment timelines for businesses and geographic regions.
"""
from typing import Dict, Any, Optional
from datetime import date
import asyncio
from fastapi import APIRouter, Depends, Path, Query

from dependencies import get_analytics_service
from services.interfaces import AnalyticsServiceInterface

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

    This endpoint combines multiple timeline queries into a single response to reduce API calls.
    Returns business data along with city and category averages for comparison.

    **Example Response:**
    ```json
    {
        "business_ratings": {...},
        "business_sentiment": {...},
        "city_ratings": {...},
        "city_sentiment": {...},
        "category_ratings": {...},
        "category_sentiment": {...}
    }
    ```
    """
    # Get business ratings and sentiment
    # Note: Can't parallelize with asyncio.gather() due to shared DB session
    business_ratings = await analytics_service.get_business_ratings_timeline(
        business_id=business_id,
        period=period,
        start_date=start_date,
        end_date=end_date
    )

    business_sentiment = await analytics_service.get_business_sentiment_timeline(
        business_id=business_id,
        period=period,
        start_date=start_date,
        end_date=end_date
    )

    # Get city and category data if available
    city_ratings = None
    city_sentiment = None
    category_ratings = None
    category_sentiment = None

    # Extract city and category from business data
    if business_ratings.get('city') and business_ratings.get('state'):
        city = business_ratings['city']
        state = business_ratings['state']
        city_ratings = await analytics_service.get_city_ratings_timeline(
            city=city,
            state=state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )
        city_sentiment = await analytics_service.get_city_sentiment_timeline(
            city=city,
            state=state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )

    # Get category data ONLY if user explicitly selected a category via filter
    if category:
        # Get city-specific category data for comparison
        category_city = business_ratings.get('city')
        category_state = business_ratings.get('state')
        category_ratings = await analytics_service.get_category_ratings_timeline(
            category=category,
            city=category_city,
            state=category_state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )
        category_sentiment = await analytics_service.get_category_sentiment_timeline(
            category=category,
            city=category_city,
            state=category_state,
            period=period,
            start_date=start_date,
            end_date=end_date
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

    Reduces API calls by combining city ratings, city sentiment, and optional category data.
    """
    # Get city ratings and sentiment
    city_ratings = await analytics_service.get_city_ratings_timeline(
        city=city,
        state=state,
        period=period,
        start_date=start_date,
        end_date=end_date
    )

    city_sentiment = await analytics_service.get_city_sentiment_timeline(
        city=city,
        state=state,
        period=period,
        start_date=start_date,
        end_date=end_date
    )

    # Get category data if provided (city-specific)
    category_ratings = None
    category_sentiment = None

    if category:
        category_ratings = await analytics_service.get_category_ratings_timeline(
            category=category,
            city=city,
            state=state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )
        category_sentiment = await analytics_service.get_category_sentiment_timeline(
            category=category,
            city=city,
            state=state,
            period=period,
            start_date=start_date,
            end_date=end_date
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

    Reduces network overhead by combining both metrics in a single HTTP request.
    Both queries use precomputed metrics for fast performance.
    """
    # Fetch both ratings and sentiment from precomputed metrics
    category_ratings = await analytics_service.get_category_ratings_timeline(
        category=category,
        period=period,
        start_date=start_date,
        end_date=end_date
    )

    category_sentiment = await analytics_service.get_category_sentiment_timeline(
        category=category,
        period=period,
        start_date=start_date,
        end_date=end_date
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
