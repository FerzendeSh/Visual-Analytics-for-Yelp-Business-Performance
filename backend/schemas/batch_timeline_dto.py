"""
Pydantic schemas for batch timeline requests and responses.
Optimizes frontend performance by batching multiple timeline queries into single request.
"""
from typing import Optional, List, Dict, Any
from datetime import date
from pydantic import BaseModel, Field


class BenchmarkRequest(BaseModel):
    """Request specification for a benchmark timeline (city/neighborhood/category)."""
    city: Optional[str] = None
    state: Optional[str] = None
    neighborhood: Optional[str] = None
    category: Optional[str] = None


class BatchTimelineRequest(BaseModel):
    """
    Request body for batch timeline endpoint.

    Allows fetching timelines for multiple businesses and benchmarks in a single request.
    """
    business_ids: List[str] = Field(
        ...,
        description="List of business IDs to fetch timelines for",
        min_length=1,
        max_length=10
    )

    period: str = Field(
        default='month',
        description="Time period for aggregation",
        pattern='^(day|week|month|year)$'
    )

    start_date: Optional[date] = Field(
        None,
        description="Start date filter (YYYY-MM-DD)"
    )

    end_date: Optional[date] = Field(
        None,
        description="End date filter (YYYY-MM-DD)"
    )

    include_city_benchmark: bool = Field(
        default=False,
        description="Include city average benchmark"
    )

    include_neighborhood_benchmark: bool = Field(
        default=False,
        description="Include neighborhood average benchmark"
    )

    include_category_benchmark: bool = Field(
        default=False,
        description="Include category average benchmark"
    )

    category: Optional[str] = Field(
        None,
        description="Category for category benchmark comparison"
    )

    # Optional location overrides for benchmarks
    # If provided, use these instead of extracting from first business
    city: Optional[str] = Field(
        None,
        description="City for benchmark data (overrides business location)"
    )

    state: Optional[str] = Field(
        None,
        description="State for benchmark data (overrides business location)"
    )

    neighborhood: Optional[str] = Field(
        None,
        description="Neighborhood for benchmark data (overrides business location)"
    )


class TimelineData(BaseModel):
    """Timeline data for a single entity (business or benchmark)."""
    ratings: Dict[str, Any] = Field(
        ...,
        description="Rating timeline data with metadata"
    )
    sentiment: Dict[str, Any] = Field(
        ...,
        description="Sentiment timeline data with metadata"
    )


class BatchTimelineResponse(BaseModel):
    """
    Response body for batch timeline endpoint.

    Contains timelines for all requested businesses and benchmarks.
    """
    businesses: Dict[str, TimelineData] = Field(
        ...,
        description="Map of business_id to timeline data"
    )

    benchmarks: Dict[str, TimelineData] = Field(
        default_factory=dict,
        description="Benchmark timelines (city, neighborhood, category)"
    )

    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Request metadata (period, date range, etc.)"
    )
