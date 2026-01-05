"""
Cluster API endpoints.
Handles HTTP requests for cluster resources.
"""
from typing import List, Optional
from datetime import date as date_type
from fastapi import APIRouter, Depends, Path, Query, HTTPException, status

from dependencies import get_cluster_service
from services.cluster_service import ClusterService
from schemas.cluster_dto import (
    ClusterCatalogResponse,
    ClusterListResponse,
    ClusterSummaryDTO,
    ClusterDetailDTO,
    ClusterTimelineDTO
)

router = APIRouter(
    prefix="/clusters",
    tags=["clusters"],
    responses={404: {"description": "Not found"}}
)


@router.get("/catalog", response_model=ClusterCatalogResponse)
async def get_cluster_catalog(
    cluster_service: ClusterService = Depends(get_cluster_service)
):
    """
    Get catalog of available cluster runs.

    Returns information about all clustering runs including:
    - All available runs (most recent first)
    - Latest/active run for default queries

    Use this endpoint to:
    - Check if clustering data is available
    - Get run_id for querying specific clustering results
    - Display clustering metadata in UI
    """
    return await cluster_service.get_catalog()


@router.get("/viewport", response_model=List[ClusterSummaryDTO])
async def get_clusters_in_viewport(
    south: float = Query(..., ge=-90, le=90, description="Southern latitude bound"),
    north: float = Query(..., ge=-90, le=90, description="Northern latitude bound"),
    west: float = Query(..., ge=-180, le=180, description="Western longitude bound"),
    east: float = Query(..., ge=-180, le=180, description="Eastern longitude bound"),
    run_id: Optional[int] = Query(None, description="Cluster run ID (default: latest)"),
    min_size: int = Query(5, ge=1, le=100, description="Minimum cluster size"),
    cluster_service: ClusterService = Depends(get_cluster_service)
):
    """
    Get clusters in viewport for map visualization.

    Returns clusters whose centroids fall within the specified geographic bounds.
    Useful for rendering cluster overlays on maps alongside business markers.

    **Query Parameters:**
    - `south`, `north`, `west`, `east`: Define viewport bounds
    - `run_id`: Optional specific run (defaults to latest)
    - `min_size`: Filter out small clusters (default: 5)

    **Use Cases:**
    - Render cluster boundaries/circles on map
    - Color businesses by cluster membership
    - Show cluster info on hover/click

    **Performance:**
    - Indexed on centroid coordinates for fast queries
    - Typically returns <50 clusters per viewport
    """
    #Validate bounds
    if south >= north:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="South latitude must be less than north latitude"
        )

    if west >= east:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="West longitude must be less than east longitude"
        )

    return await cluster_service.get_clusters_in_viewport(
        south=south,
        north=north,
        west=west,
        east=east,
        run_id=run_id,
        min_size=min_size
    )


@router.get("/", response_model=ClusterListResponse)
async def list_clusters(
    run_id: Optional[int] = Query(None, description="Cluster run ID (default: latest)"),
    city: Optional[str] = Query(None, description="Filter by city"),
    min_size: Optional[int] = Query(None, ge=1, description="Minimum cluster size"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(50, ge=1, le=200, description="Maximum results"),
    cluster_service: ClusterService = Depends(get_cluster_service)
):
    """
    List all clusters with optional filters and pagination.

    **Filters:**
    - `run_id`: Specific clustering run (defaults to latest)
    - `city`: Filter to clusters in specific city
    - `min_size`: Minimum number of businesses in cluster

    **Pagination:**
    - `skip`: Number of results to skip
    - `limit`: Maximum results to return (max 200)

    **Returns:**
    - `clusters`: Array of cluster summaries
    - `total`: Total count matching filters
    - `skip`, `limit`: Echo pagination params

    **Use Cases:**
    - Browse all available clusters
    - Build cluster filter dropdown
    - Cluster exploration UI
    """
    return await cluster_service.get_clusters(
        run_id=run_id,
        city=city,
        min_size=min_size,
        skip=skip,
        limit=limit
    )


@router.get("/{cluster_id}", response_model=ClusterDetailDTO)
async def get_cluster_detail(
    cluster_id: int = Path(..., description="Cluster identifier"),
    cluster_service: ClusterService = Depends(get_cluster_service)
):
    """
    Get detailed information about a specific cluster.

    Returns comprehensive cluster metadata including:
    - AI-generated label and description
    - Quality metrics (silhouette, Davies-Bouldin, etc.)
    - Top categories and attribute patterns
    - Geographic statistics
    - Algorithm parameters used

    **Use Cases:**
    - Display cluster details panel
    - Show cluster composition
    - Competitive analysis deep-dive
    """
    cluster = await cluster_service.get_cluster_detail(cluster_id)

    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cluster {cluster_id} not found"
        )

    return cluster


@router.get("/{cluster_id}/timeline", response_model=ClusterTimelineDTO)
async def get_cluster_timeline(
    cluster_id: int = Path(..., description="Cluster identifier"),
    period: str = Query('month', regex='^(month|year)$', description="Aggregation period"),
    start_date: Optional[date_type] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date_type] = Query(None, description="End date (YYYY-MM-DD)"),
    cluster_service: ClusterService = Depends(get_cluster_service)
):
    """
    Get time series data for a cluster.

    Returns pre-computed timeline metrics showing how the cluster's
    performance evolves over time.

    **Metrics Returned:**
    - Average rating over time
    - Average sentiment over time
    - Review volume per period
    - Active business count per period

    **Query Parameters:**
    - `period`: 'month' or 'year' aggregation
    - `start_date`: Optional date filter (ISO format YYYY-MM-DD)
    - `end_date`: Optional date filter (ISO format YYYY-MM-DD)

    **Use Cases:**
    - Add cluster benchmark to comparison charts
    - Show "Cluster Average" line alongside business timelines
    - Trend analysis for competitive segments
    - Compare cluster performance across time periods

    **Performance:**
    - Uses pre-computed ClusterTimelineMetrics table
    - Fast queries (<100ms) even for years of data
    """
    timeline = await cluster_service.get_cluster_timeline(
        cluster_id=cluster_id,
        period=period,
        start_date=start_date,
        end_date=end_date
    )

    if not timeline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cluster {cluster_id} not found"
        )

    return timeline


@router.get("/{cluster_id}/businesses", response_model=List[str])
async def get_cluster_businesses(
    cluster_id: int = Path(..., description="Cluster identifier"),
    limit: Optional[int] = Query(None, ge=1, le=1000, description="Maximum business IDs to return"),
    cluster_service: ClusterService = Depends(get_cluster_service)
):
    """
    Get business IDs for a cluster.

    Returns list of business_id strings for all businesses in the cluster.
    Use this to:
    - Filter map to show only cluster members
    - Highlight cluster businesses
    - Batch fetch business details

    **Pagination:**
    - `limit`: Optional limit on results (max 1000)
    - Omit to get all businesses in cluster

    **Example Response:**
    ```json
    ["abc123", "def456", "ghi789"]
    ```
    """
    # Verify cluster exists first
    cluster = await cluster_service.get_cluster_detail(cluster_id)
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cluster {cluster_id} not found"
        )

    return await cluster_service.get_business_ids_in_cluster(cluster_id, limit)
