"""
Analytics API endpoints for time-series data.
Provides rating and sentiment timelines for businesses and geographic regions.
"""
from typing import Dict, Any, Optional
from datetime import date
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
