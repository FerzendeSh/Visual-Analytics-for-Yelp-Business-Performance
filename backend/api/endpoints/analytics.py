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


@router.get("/business/{business_id}/ratings-timeline", response_model=Dict[str, Any])
async def get_business_ratings_timeline(
    business_id: str = Path(..., description="Business identifier"),
    period: str = Query('month', regex='^(day|week|month|year)$', description="Time period for aggregation"),
    start_date: Optional[date] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date filter (YYYY-MM-DD)"),
    analytics_service: AnalyticsServiceInterface = Depends(get_analytics_service)
):
    """
    Get average ratings over time for a specific business.

    Returns time-series data showing how the business's average rating changes over time.
    Perfect for line charts showing rating trends.

    **Example Response:**
    ```json
    {
        "business_id": "abc123",
        "business_name": "Joe's Pizza",
        "period": "month",
        "metric": "rating",
        "data": [
            {
                "period_start": "2023-01",
                "avg_rating": 4.2,
                "review_count": 15
            },
            {
                "period_start": "2023-02",
                "avg_rating": 4.5,
                "review_count": 22
            }
        ]
    }
    ```
    """
    return await analytics_service.get_business_ratings_timeline(
        business_id=business_id,
        period=period,
        start_date=start_date,
        end_date=end_date
    )


@router.get("/business/{business_id}/sentiment-timeline", response_model=Dict[str, Any])
async def get_business_sentiment_timeline(
    business_id: str = Path(..., description="Business identifier"),
    period: str = Query('month', regex='^(day|week|month|year)$', description="Time period for aggregation"),
    start_date: Optional[date] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date filter (YYYY-MM-DD)"),
    analytics_service: AnalyticsServiceInterface = Depends(get_analytics_service)
):
    """
    Get average sentiment scores over time for a specific business.

    Returns time-series data showing how the business's sentiment changes over time.
    Includes both probability-based and expected sentiment scores.

    **Example Response:**
    ```json
    {
        "business_id": "abc123",
        "business_name": "Joe's Pizza",
        "period": "month",
        "metric": "sentiment",
        "data": [
            {
                "period_start": "2023-01",
                "avg_sentiment_score": 0.75,
                "avg_sentiment_expected": 0.72,
                "review_count": 15
            }
        ]
    }
    ```
    """
    return await analytics_service.get_business_sentiment_timeline(
        business_id=business_id,
        period=period,
        start_date=start_date,
        end_date=end_date
    )


@router.get("/business/{business_id}/comparison/city", response_model=Dict[str, Any])
async def get_business_timeline_with_city_comparison(
    business_id: str = Path(..., description="Business identifier"),
    metric: str = Query('rating', regex='^(rating|sentiment)$', description="Metric to compare"),
    period: str = Query('month', regex='^(day|week|month|year)$', description="Time period for aggregation"),
    start_date: Optional[date] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date filter (YYYY-MM-DD)"),
    analytics_service: AnalyticsServiceInterface = Depends(get_analytics_service)
):
    """
    Get business timeline compared with city average.

    Returns both the business's metrics and the city average over time for comparison.
    Perfect for showing how a business performs relative to its city.

    **Example Response:**
    ```json
    {
        "business_id": "abc123",
        "business_name": "Joe's Pizza",
        "city": "Philadelphia",
        "state": "PA",
        "period": "month",
        "metric": "rating",
        "business_data": [...],
        "city_average": [...]
    }
    ```
    """
    return await analytics_service.get_business_timeline_with_city_comparison(
        business_id=business_id,
        metric=metric,
        period=period,
        start_date=start_date,
        end_date=end_date
    )


@router.get("/business/{business_id}/comparison/state", response_model=Dict[str, Any])
async def get_business_timeline_with_state_comparison(
    business_id: str = Path(..., description="Business identifier"),
    metric: str = Query('rating', regex='^(rating|sentiment)$', description="Metric to compare"),
    period: str = Query('month', regex='^(day|week|month|year)$', description="Time period for aggregation"),
    start_date: Optional[date] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date filter (YYYY-MM-DD)"),
    analytics_service: AnalyticsServiceInterface = Depends(get_analytics_service)
):
    """
    Get business timeline compared with state average.

    Returns both the business's metrics and the state average over time for comparison.
    Perfect for showing how a business performs relative to its state.

    **Example Response:**
    ```json
    {
        "business_id": "abc123",
        "business_name": "Joe's Pizza",
        "state": "PA",
        "period": "month",
        "metric": "rating",
        "business_data": [...],
        "state_average": [...]
    }
    ```
    """
    return await analytics_service.get_business_timeline_with_state_comparison(
        business_id=business_id,
        metric=metric,
        period=period,
        start_date=start_date,
        end_date=end_date
    )


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


@router.get("/city/{state}/{city}/ratings-timeline", response_model=Dict[str, Any])
async def get_city_ratings_timeline(
    state: str = Path(..., min_length=2, max_length=2, description="State code (e.g., 'PA')"),
    city: str = Path(..., min_length=1, description="City name"),
    period: str = Query('month', regex='^(day|week|month|year)$', description="Time period for aggregation"),
    start_date: Optional[date] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date filter (YYYY-MM-DD)"),
    analytics_service: AnalyticsServiceInterface = Depends(get_analytics_service)
):
    """
    Get average ratings over time for all businesses in a city.

    Returns city-wide averages aggregated from all businesses in the city.
    Perfect for comparing different cities' performance over time.

    **Example Response:**
    ```json
    {
        "city": "Philadelphia",
        "state": "PA",
        "period": "month",
        "metric": "rating",
        "data": [
            {
                "period_start": "2023-01",
                "avg_rating": 3.8,
                "review_count": 1542,
                "business_count": 120
            }
        ]
    }
    ```
    """
    return await analytics_service.get_city_ratings_timeline(
        city=city,
        state=state,
        period=period,
        start_date=start_date,
        end_date=end_date
    )


@router.get("/state/{state}/ratings-timeline", response_model=Dict[str, Any])
async def get_state_ratings_timeline(
    state: str = Path(..., min_length=2, max_length=2, description="State code (e.g., 'PA')"),
    period: str = Query('month', regex='^(day|week|month|year)$', description="Time period for aggregation"),
    start_date: Optional[date] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date filter (YYYY-MM-DD)"),
    analytics_service: AnalyticsServiceInterface = Depends(get_analytics_service)
):
    """
    Get average ratings over time for all businesses in a state.

    Returns state-wide averages aggregated from all businesses in the state.
    Perfect for comparing different states' performance over time.

    **Example Response:**
    ```json
    {
        "state": "PA",
        "period": "month",
        "metric": "rating",
        "data": [
            {
                "period_start": "2023-01",
                "avg_rating": 3.7,
                "review_count": 15420,
                "business_count": 1250
            }
        ]
    }
    ```
    """
    return await analytics_service.get_state_ratings_timeline(
        state=state,
        period=period,
        start_date=start_date,
        end_date=end_date
    )


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


@router.get("/category/{category}/ratings-timeline", response_model=Dict[str, Any])
async def get_category_ratings_timeline(
    category: str = Path(..., min_length=1, description="Category name"),
    period: str = Query('month', regex='^(day|week|month|year)$', description="Time period for aggregation"),
    start_date: Optional[date] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date filter (YYYY-MM-DD)"),
    analytics_service: AnalyticsServiceInterface = Depends(get_analytics_service)
):
    """
    Get average ratings over time for all businesses in a category.

    Returns category-wide averages aggregated from all businesses in the category.
    Perfect for comparing different categories' performance over time.

    **Example Response:**
    ```json
    {
        "category": "Restaurants",
        "period": "month",
        "metric": "rating",
        "data": [
            {
                "period_start": "2023-01",
                "avg_rating": 3.9,
                "review_count": 5420,
                "business_count": 450
            }
        ]
    }
    ```
    """
    return await analytics_service.get_category_ratings_timeline(
        category=category,
        period=period,
        start_date=start_date,
        end_date=end_date
    )


@router.get("/category/{category}/sentiment-timeline", response_model=Dict[str, Any])
async def get_category_sentiment_timeline(
    category: str = Path(..., min_length=1, description="Category name"),
    period: str = Query('month', regex='^(day|week|month|year)$', description="Time period for aggregation"),
    start_date: Optional[date] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date filter (YYYY-MM-DD)"),
    analytics_service: AnalyticsServiceInterface = Depends(get_analytics_service)
):
    """
    Get average sentiment scores over time for all businesses in a category.

    Returns category-wide sentiment averages aggregated from all businesses in the category.
    Perfect for comparing different categories' sentiment trends over time.

    **Example Response:**
    ```json
    {
        "category": "Restaurants",
        "period": "month",
        "metric": "sentiment",
        "data": [
            {
                "period_start": "2023-01",
                "avg_sentiment_score": 0.65,
                "avg_sentiment_expected": 0.62,
                "review_count": 5420
            }
        ]
    }
    ```
    """
    return await analytics_service.get_category_sentiment_timeline(
        category=category,
        period=period,
        start_date=start_date,
        end_date=end_date
    )


@router.get("/city/{state}/{city}/sentiment-timeline", response_model=Dict[str, Any])
async def get_city_sentiment_timeline(
    state: str = Path(..., min_length=2, max_length=2, description="State code (e.g., 'PA')"),
    city: str = Path(..., min_length=1, description="City name"),
    period: str = Query('month', regex='^(day|week|month|year)$', description="Time period for aggregation"),
    start_date: Optional[date] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date filter (YYYY-MM-DD)"),
    analytics_service: AnalyticsServiceInterface = Depends(get_analytics_service)
):
    """
    Get average sentiment scores over time for all businesses in a city.

    Returns city-wide sentiment averages aggregated from all businesses in the city.
    Perfect for comparing different cities' sentiment trends over time.

    **Example Response:**
    ```json
    {
        "city": "Philadelphia",
        "state": "PA",
        "period": "month",
        "metric": "sentiment",
        "data": [
            {
                "period_start": "2023-01",
                "avg_sentiment_score": 0.75,
                "avg_sentiment_expected": 0.72,
                "review_count": 1542
            }
        ]
    }
    ```
    """
    return await analytics_service.get_city_sentiment_timeline(
        city=city,
        state=state,
        period=period,
        start_date=start_date,
        end_date=end_date
    )


@router.get("/state/{state}/sentiment-timeline", response_model=Dict[str, Any])
async def get_state_sentiment_timeline(
    state: str = Path(..., min_length=2, max_length=2, description="State code (e.g., 'PA')"),
    period: str = Query('month', regex='^(day|week|month|year)$', description="Time period for aggregation"),
    start_date: Optional[date] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date filter (YYYY-MM-DD)"),
    analytics_service: AnalyticsServiceInterface = Depends(get_analytics_service)
):
    """
    Get average sentiment scores over time for all businesses in a state.

    Returns state-wide sentiment averages aggregated from all businesses in the state.
    Perfect for comparing different states' sentiment trends over time.

    **Example Response:**
    ```json
    {
        "state": "PA",
        "period": "month",
        "metric": "sentiment",
        "data": [
            {
                "period_start": "2023-01",
                "avg_sentiment_score": 0.72,
                "avg_sentiment_expected": 0.70,
                "review_count": 15420
            }
        ]
    }
    ```
    """
    return await analytics_service.get_state_sentiment_timeline(
        state=state,
        period=period,
        start_date=start_date,
        end_date=end_date
    )


# ============================================================================
# Competitive Positioning Endpoints
# ============================================================================

@router.get("/competitive-snapshot", response_model=Dict[str, Any])
async def get_competitive_snapshot(
    city: Optional[str] = Query(None, description="Filter by city name"),
    state: Optional[str] = Query(None, min_length=2, max_length=2, description="Filter by state code (e.g., 'PA')"),
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
        category=category,
        business_id=business_id
    )
