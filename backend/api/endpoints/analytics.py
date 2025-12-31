"""
Analytics API endpoints for time-series data.
Provides rating and sentiment timelines for businesses and geographic regions.
"""
import asyncio
from typing import Dict, Any, Optional
from datetime import date
from fastapi import APIRouter, Depends, Path, Query, HTTPException, Body

from dependencies import (
    get_analytics_service,
    get_forecast_service,
    get_keyword_service,
    get_review_repository,
    get_business_repository
)
from services.interfaces import AnalyticsServiceInterface
from services.forecast_service import ForecastService
from services.keyword_service import KeywordService
from repositories.interfaces import ReviewRepositoryInterface, BusinessRepositoryInterface
from schemas.batch_timeline_dto import BatchTimelineRequest, BatchTimelineResponse

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

    NOTE: Sequential execution required to avoid SQLAlchemy session concurrency issues.
    """
    business_ratings = await analytics_service.get_business_ratings_timeline(
        business_id=business_id, period=period, start_date=start_date, end_date=end_date
    )
    business_sentiment = await analytics_service.get_business_sentiment_timeline(
        business_id=business_id, period=period, start_date=start_date, end_date=end_date
    )

    city_ratings = None
    city_sentiment = None
    category_ratings = None
    category_sentiment = None

    if business_ratings.get('city') and business_ratings.get('state'):
        city = business_ratings['city']
        state = business_ratings['state']

        city_ratings = await analytics_service.get_city_ratings_timeline(
            city=city, state=state, period=period, start_date=start_date, end_date=end_date
        )
        city_sentiment = await analytics_service.get_city_sentiment_timeline(
            city=city, state=state, period=period, start_date=start_date, end_date=end_date
        )

        if category:
            category_ratings = await analytics_service.get_category_ratings_timeline(
                category=category, city=city, state=state,
                period=period, start_date=start_date, end_date=end_date
            )
            category_sentiment = await analytics_service.get_category_sentiment_timeline(
                category=category, city=city, state=state,
                period=period, start_date=start_date, end_date=end_date
            )

    return {
        "business_ratings": business_ratings,
        "business_sentiment": business_sentiment,
        "city_ratings": city_ratings,
        "city_sentiment": city_sentiment,
        "category_ratings": category_ratings,
        "category_sentiment": category_sentiment
    }


@router.post("/batch-timelines", response_model=BatchTimelineResponse)
async def get_batch_timelines(
    request: BatchTimelineRequest = Body(..., description="Batch timeline request specification"),
    analytics_service: AnalyticsServiceInterface = Depends(get_analytics_service)
):
    """
    Fetch timelines for multiple businesses and optional benchmarks in a single request.

    NOTE: Sequential execution required to avoid SQLAlchemy session concurrency issues.

    **Request Body**:
    - `business_ids`: List of 1-10 business IDs to fetch timelines for
    - `period`: Aggregation period (day/week/month/year)
    - `start_date`, `end_date`: Optional date range filters
    - `include_city_benchmark`: Include city average timeline
    - `include_neighborhood_benchmark`: Include neighborhood average timeline
    - `include_category_benchmark`: Include category average timeline
    - `category`: Category for benchmark (if include_category_benchmark=True)

    **Response**:
    - `businesses`: Map of business_id to {ratings, sentiment} timelines
    - `benchmarks`: Map of benchmark names to timelines (e.g., "city", "category")
    - `metadata`: Request parameters and summary info (includes warning if businesses span multiple cities)
    """
    # Phase 1: Fetch all business timelines
    businesses_data = {}
    for business_id in request.business_ids:
        ratings = await analytics_service.get_business_ratings_timeline(
            business_id=business_id,
            period=request.period,
            start_date=request.start_date,
            end_date=request.end_date
        )
        sentiment = await analytics_service.get_business_sentiment_timeline(
            business_id=business_id,
            period=request.period,
            start_date=request.start_date,
            end_date=request.end_date
        )

        businesses_data[business_id] = {
            "ratings": ratings,
            "sentiment": sentiment
        }

    # Phase 2: Check if all businesses are in same location
    locations = set()
    for biz_data in businesses_data.values():
        ratings = biz_data.get('ratings', {})
        loc = (ratings.get('city'), ratings.get('state'), ratings.get('neighborhood'))
        if loc[0] and loc[1]:
            locations.add(loc)

    first_business_id = request.business_ids[0] if request.business_ids else None
    first_business_ratings = businesses_data.get(first_business_id, {}).get('ratings', {}) if first_business_id else {}
    city = first_business_ratings.get('city')
    state = first_business_ratings.get('state')
    neighborhood = first_business_ratings.get('neighborhood')

    mixed_locations = len(locations) > 1
    location_warning = None
    if mixed_locations and (request.include_city_benchmark or request.include_neighborhood_benchmark):
        location_warning = f"Businesses span {len(locations)} different locations. Benchmarks are for {city}, {state} only."

    # Phase 3: Fetch benchmarks if requested
    benchmarks_data = {}

    if request.include_city_benchmark and city and state:
        city_ratings = await analytics_service.get_city_ratings_timeline(
            city=city,
            state=state,
            period=request.period,
            start_date=request.start_date,
            end_date=request.end_date
        )
        city_sentiment = await analytics_service.get_city_sentiment_timeline(
            city=city,
            state=state,
            period=request.period,
            start_date=request.start_date,
            end_date=request.end_date
        )
        benchmarks_data['city'] = {
            'ratings': city_ratings,
            'sentiment': city_sentiment
        }

    if request.include_neighborhood_benchmark and neighborhood and city and state:
        neighborhood_ratings = await analytics_service.get_neighborhood_ratings_timeline(
            neighborhood=neighborhood,
            city=city,
            state=state,
            period=request.period,
            start_date=request.start_date,
            end_date=request.end_date
        )
        neighborhood_sentiment = await analytics_service.get_neighborhood_sentiment_timeline(
            neighborhood=neighborhood,
            city=city,
            state=state,
            period=request.period,
            start_date=request.start_date,
            end_date=request.end_date
        )
        benchmarks_data['neighborhood'] = {
            'ratings': neighborhood_ratings,
            'sentiment': neighborhood_sentiment
        }

    if request.include_category_benchmark and request.category:
        category_ratings = await analytics_service.get_category_ratings_timeline(
            category=request.category,
            city=city,
            state=state,
            period=request.period,
            start_date=request.start_date,
            end_date=request.end_date
        )
        category_sentiment = await analytics_service.get_category_sentiment_timeline(
            category=request.category,
            city=city,
            state=state,
            period=request.period,
            start_date=request.start_date,
            end_date=request.end_date
        )
        benchmarks_data['category'] = {
            'ratings': category_ratings,
            'sentiment': category_sentiment
        }

    # Build metadata
    metadata = {
        'period': request.period,
        'start_date': request.start_date.isoformat() if request.start_date else None,
        'end_date': request.end_date.isoformat() if request.end_date else None,
        'business_count': len(request.business_ids),
        'benchmark_count': len(benchmarks_data),
        'location': {
            'city': city,
            'state': state,
            'neighborhood': neighborhood
        } if city else None,
        'mixed_locations': mixed_locations,
        'unique_location_count': len(locations),
        'warning': location_warning
    }

    return BatchTimelineResponse(
        businesses=businesses_data,
        benchmarks=benchmarks_data,
        metadata=metadata
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

    NOTE: Sequential execution required to avoid SQLAlchemy session concurrency issues.
    """
    city_ratings = await analytics_service.get_city_ratings_timeline(
        city=city, state=state, period=period, start_date=start_date, end_date=end_date
    )
    city_sentiment = await analytics_service.get_city_sentiment_timeline(
        city=city, state=state, period=period, start_date=start_date, end_date=end_date
    )

    category_ratings = None
    category_sentiment = None

    if category:
        category_ratings = await analytics_service.get_category_ratings_timeline(
            category=category, city=city, state=state,
            period=period, start_date=start_date, end_date=end_date
        )
        category_sentiment = await analytics_service.get_category_sentiment_timeline(
            category=category, city=city, state=state,
            period=period, start_date=start_date, end_date=end_date
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

    NOTE: Sequential execution required to avoid SQLAlchemy session concurrency issues.
    """
    category_ratings = await analytics_service.get_category_ratings_timeline(
        category=category, period=period, start_date=start_date, end_date=end_date
    )
    category_sentiment = await analytics_service.get_category_sentiment_timeline(
        category=category, period=period, start_date=start_date, end_date=end_date
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

    NOTE: Sequential execution required to avoid SQLAlchemy session concurrency issues.

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
    review_repository: ReviewRepositoryInterface = Depends(get_review_repository),
    business_repository: BusinessRepositoryInterface = Depends(get_business_repository),
    keyword_service: KeywordService = Depends(get_keyword_service)
):
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must be before end_date")

    business = await business_repository.get_by_id(business_id)
    business_name = business.name if business else None

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

    result = keyword_service.analyze_period(reviews, business_name)
    result['period'] = {
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat()
    }
    return result


@router.get("/business/{business_id}/keyword-insights-auto", response_model=Dict[str, Any])
async def get_keyword_insights_auto(
    business_id: str = Path(..., description="Business identifier"),
    max_years: int = Query(5, ge=1, le=10, description="Maximum number of years to search back"),
    review_repository: ReviewRepositoryInterface = Depends(get_review_repository),
    business_repository: BusinessRepositoryInterface = Depends(get_business_repository),
    keyword_service: KeywordService = Depends(get_keyword_service)
):
    """
    Automatically find and return keyword insights from the most recent year with sufficient data.

    OPTIMIZED: Uses single SQL query to find best year instead of sequential year loop.

    Searches backwards from the current year up to `max_years` years ago,
    and returns insights from the first year with meaningful keyword data.

    This endpoint is optimized for frontend performance by eliminating the need
    for multiple sequential API calls to find valid data.
    """
    business = await business_repository.get_by_id(business_id)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    business_name = business.name

    # OPTIMIZED: Single query to find most recent year with reviews
    most_recent_year = await review_repository.get_most_recent_year_with_reviews(
        business_id=business_id,
        max_years_back=max_years,
        min_review_count=5  # Require at least 5 reviews for meaningful keywords
    )

    if not most_recent_year:
        # No data found in any year
        return {
            'complaints': [],
            'praises': [],
            'total_reviews': 0,
            'negative_count': 0,
            'positive_count': 0,
            'period': {
                'start_date': None,
                'end_date': None,
                'year': None
            },
            'message': f'No keyword data found in the past {max_years} years'
        }

    # Fetch reviews for the best year found
    start_date = date(most_recent_year, 1, 1)
    end_date = date(most_recent_year, 12, 31)

    reviews = await review_repository.get_by_business_and_date_range(
        business_id=business_id,
        start_date=start_date,
        end_date=end_date
    )

    if not reviews:
        # Shouldn't happen since we found the year, but handle edge case
        return {
            'complaints': [],
            'praises': [],
            'total_reviews': 0,
            'negative_count': 0,
            'positive_count': 0,
            'period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'year': most_recent_year
            }
        }

    # Analyze keywords
    result = keyword_service.analyze_period(reviews, business_name)
    result['period'] = {
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'year': most_recent_year
    }

    return result
