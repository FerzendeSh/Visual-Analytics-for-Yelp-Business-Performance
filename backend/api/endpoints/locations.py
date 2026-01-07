"""
Location API endpoints.
Handles requests for states and cities data.
"""
from typing import List, Optional, Dict, Any
import asyncio
import json
import logging
import time
from pathlib import Path
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database.database import get_async_session
from repositories.business_repository import BusinessRepository
from repositories.interfaces import BusinessRepositoryInterface

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["locations"]
)


# ============================================================================
# TTL Cache for Location Data (reduces DB hits for static data)
# ============================================================================

class TTLCache:
    """Simple TTL cache for async functions."""
    
    def __init__(self, ttl_seconds: int = 3600):
        self._cache: Dict[str, Any] = {}
        self._timestamps: Dict[str, float] = {}
        self._ttl = ttl_seconds
    
    def get(self, key: str) -> Optional[Any]:
        """Get cached value if not expired."""
        if key in self._cache:
            if time.time() - self._timestamps[key] < self._ttl:
                return self._cache[key]
            # Expired - remove
            del self._cache[key]
            del self._timestamps[key]
        return None
    
    def set(self, key: str, value: Any) -> None:
        """Cache a value with current timestamp."""
        self._cache[key] = value
        self._timestamps[key] = time.time()
    
    def clear(self) -> None:
        """Clear all cached values."""
        self._cache.clear()
        self._timestamps.clear()


# Cache instances (1 hour TTL for location data, 30 min for GeoJSON)
_location_cache = TTLCache(ttl_seconds=3600)
_geojson_cache = TTLCache(ttl_seconds=1800)


def get_business_repository(
    db: AsyncSession = Depends(get_async_session)
) -> BusinessRepositoryInterface:
    return BusinessRepository(db)


def _load_geojson_sync(path: Path) -> dict:
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if 'crs' in data:
        del data['crs']
    return data


@router.get("/states", response_model=List[str])
async def get_states(
    repo: BusinessRepositoryInterface = Depends(get_business_repository)
):
    """
    Get list of all states that have businesses.

    Returns a list of 2-letter state codes (e.g., 'PA', 'TN', 'CA') for states
    that contain at least one business in the database.

    **Use Case**: Populate state dropdown/filter in the dashboard UI.

    **Example Response:**
    ```json
    ["AZ", "CA", "FL", "NV", "PA", "TN"]
    ```
    """
    cache_key = "states"
    cached = _location_cache.get(cache_key)
    if cached is not None:
        return cached
    
    result = await repo.get_states()
    _location_cache.set(cache_key, result)
    return result


@router.get("/cities", response_model=List[str])
async def get_cities(
    state: str = Query(..., min_length=2, max_length=2, description="State code (e.g., 'PA', 'TN')"),
    repo: BusinessRepositoryInterface = Depends(get_business_repository)
):
    """
    Get list of all cities in a specific state that have businesses.

    Returns city names alphabetically sorted for the given state code.

    **Use Case**: Populate city dropdown after user selects a state.

    **Parameters:**
    - `state`: 2-letter state code (case-insensitive, converted to uppercase)

    **Example Request:** `GET /cities?state=PA`

    **Example Response:**
    ```json
    ["Allentown", "Philadelphia", "Pittsburgh"]
    ```
    """
    state_upper = state.upper()
    cache_key = f"cities:{state_upper}"
    cached = _location_cache.get(cache_key)
    if cached is not None:
        return cached
    
    result = await repo.get_cities_by_state(state_upper)
    _location_cache.set(cache_key, result)
    return result


@router.get("/neighborhoods", response_model=List[str])
async def get_neighborhoods(
    state: str = Query(..., min_length=2, max_length=2, description="State code (e.g., 'PA', 'TN')"),
    city: str = Query(..., min_length=1, description="City name (e.g., 'Philadelphia', 'Nashville')"),
    repo: BusinessRepositoryInterface = Depends(get_business_repository)
):
    """
    Get list of all neighborhoods in a specific city that have businesses.

    Returns neighborhood names for the given city/state combination.
    Neighborhoods are assigned to businesses based on geographic boundaries.

    **Use Case**: Populate neighborhood filter dropdown after user selects a city.

    **Parameters:**
    - `state`: 2-letter state code (case-insensitive)
    - `city`: City name (case-sensitive match)

    **Example Request:** `GET /neighborhoods?state=PA&city=Philadelphia`

    **Example Response:**
    ```json
    ["Center City", "Fishtown", "Northern Liberties", "University City"]
    ```
    """
    state_upper = state.upper()
    cache_key = f"neighborhoods:{state_upper}:{city}"
    cached = _location_cache.get(cache_key)
    if cached is not None:
        return cached
    
    result = await repo.get_neighborhoods_by_city(state_upper, city)
    _location_cache.set(cache_key, result)
    return result


@router.get("/neighborhoods/boundaries")
async def get_neighborhood_boundaries(
    state: str = Query(..., min_length=2, max_length=2, description="State code (e.g., 'PA', 'TN')"),
    city: str = Query(..., min_length=1, description="City name (e.g., 'Philadelphia', 'Nashville')"),
    repo: BusinessRepositoryInterface = Depends(get_business_repository)
):
    """
    Get GeoJSON boundaries for neighborhoods in a specific city.

    Returns a GeoJSON FeatureCollection containing polygon boundaries for all
    neighborhoods in the specified city. Used for rendering neighborhood
    overlays on the map.

    **Use Case**: Display neighborhood boundaries on the interactive map.

    **Parameters:**
    - `state`: 2-letter state code
    - `city`: City name

    **Response Format:** GeoJSON FeatureCollection
    ```json
    {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": "Center City"},
                "geometry": {"type": "Polygon", "coordinates": [...]}
            }
        ]
    }
    ```

    **Errors:**
    - `404`: Neighborhood boundaries not available for the specified city
    - `500`: Error loading boundary file
    """
    state_upper = state.upper()
    cache_key = f"neighborhood_boundaries:{state_upper}:{city}"
    cached = _geojson_cache.get(cache_key)
    if cached is not None:
        return cached
    
    geojson_filename = await repo.get_neighborhood_geojson_filename(state_upper, city)

    if not geojson_filename:
        raise HTTPException(
            status_code=404,
            detail=f"Neighborhood boundaries not available for {city}, {state}"
        )

    geojson_path = Path(__file__).parent.parent.parent / "public" / "neighborhoods" / geojson_filename

    if not geojson_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Neighborhood boundaries file not found for {city}, {state}"
        )

    try:
        result = await asyncio.to_thread(_load_geojson_sync, geojson_path)
        _geojson_cache.set(cache_key, result)
        return result
    except Exception as e:
        logger.exception(f"Error loading neighborhood boundaries for {city}, {state}")
        raise HTTPException(status_code=500, detail=f"Error loading neighborhood boundaries: {str(e)}")


@router.get("/cities/boundaries")
async def get_city_boundaries(
    state: str = Query(..., min_length=2, max_length=2, description="State code (e.g., 'PA', 'TN')"),
    city: str = Query(..., min_length=1, description="City name (e.g., 'Philadelphia', 'Nashville')"),
):
    """
    Get GeoJSON boundary for an entire city.

    Returns a GeoJSON Feature containing the polygon boundary for the specified city.
    Used for rendering city outline on the map and constraining the viewport.

    **Use Case**: Display city boundary overlay and set initial map bounds.

    **Parameters:**
    - `state`: 2-letter state code
    - `city`: City name

    **Response Format:** GeoJSON object
    ```json
    {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": "Philadelphia"},
                "geometry": {"type": "Polygon", "coordinates": [...]}
            }
        ]
    }
    ```

    **Errors:**
    - `404`: City boundary not available
    - `500`: Error loading boundary file
    """
    state_lower = state.lower()
    normalized_city = city.lower().replace(' ', '_').replace('.', '').replace('/', '_').replace('-', '_').replace("'", '')
    city_state_key = f"{normalized_city}_{state_lower}"
    
    cache_key = f"city_boundaries:{city_state_key}"
    cached = _geojson_cache.get(cache_key)
    if cached is not None:
        return cached
    
    geojson_path = Path(__file__).parent.parent.parent / "public" / "cities" / f"{city_state_key}.geojson"

    if not geojson_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"City boundary not available for {city}, {state}"
        )

    try:
        result = await asyncio.to_thread(_load_geojson_sync, geojson_path)
        _geojson_cache.set(cache_key, result)
        return result
    except Exception as e:
        logger.exception(f"Error loading city boundary for {city}, {state}")
        raise HTTPException(status_code=500, detail=f"Error loading city boundary: {str(e)}")
