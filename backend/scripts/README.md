# Scripts Directory

This directory contains production scripts for managing the Yelp Business Performance application.

## Production Scripts

### Database Setup & Seeding

**`seed_database.py`**
- **Purpose**: Initial database seeding with Yelp business data
- **When to use**: First-time setup or complete data refresh
- **Usage**: `python seed_database.py`

**`create_metrics_tables.py`**
- **Purpose**: Create database tables for pre-computed metrics
- **When to use**: Database schema setup or after migrations
- **Usage**: `python create_metrics_tables.py`

### Metrics & Analytics

**`compute_neighborhood_metrics.py`**
- **Purpose**: Compute and cache neighborhood-level metrics
- **When to use**: After data updates or to refresh cached metrics
- **Usage**: `python compute_neighborhood_metrics.py`

**`populate_metrics.py`**
- **Purpose**: Populate metrics tables with computed data
- **When to use**: Initial metrics setup or periodic refresh
- **Usage**: `python populate_metrics.py`

### Boundary Data Management

**`process_official_data.py`**
- **Purpose**: Process official Zillow & Census boundary data into city-specific GeoJSON files
- **When to use**:
  - Initial setup
  - Refreshing boundary data
  - After adding new cities
- **Usage**: `python process_official_data.py`
- **Output**:
  - `backend/public/neighborhoods/` - Neighborhood boundaries (Zillow)
  - `backend/public/cities/` - City boundaries (Census)

**`generate_fallback_neighborhoods.py`**
- **Purpose**: Generate census-tract neighborhoods for cities without Zillow data
- **When to use**:
  - After adding new cities that lack Zillow coverage
  - Filling gaps in neighborhood coverage
- **Usage**: `python generate_fallback_neighborhoods.py`
- **Output**: `backend/public/neighborhoods/` - Census-based neighborhood boundaries

**`assign_zillow_neighborhoods.py`**
- **Purpose**: Assign businesses to Zillow neighborhoods using spatial joins
- **When to use**:
  - After updating boundary data
  - Fixing incorrect neighborhood assignments
  - New business data import
- **Usage**:
  - Dry run: `python assign_zillow_neighborhoods.py --dry-run`
  - Execute: `python assign_zillow_neighborhoods.py --batch-size 500`

## Data Directories

### Required Data Sources

- `neighborhood-GeoJSON/` - Zillow neighborhood boundaries by state
- `cities/` - US Census city boundaries by state
- `neighborhood_data/census_tracts/` - Census tract shapefiles
- `wof_us_neighborhoods/` - Who's On First neighborhood data (optional)

## Workflow for New Setup

1. **Database Setup**
   ```bash
   python create_metrics_tables.py
   python seed_database.py
   ```

2. **Generate Boundaries**
   ```bash
   python process_official_data.py
   python generate_fallback_neighborhoods.py
   ```

3. **Assign Neighborhoods**
   ```bash
   python assign_zillow_neighborhoods.py --batch-size 500
   ```

4. **Compute Metrics**
   ```bash
   python compute_neighborhood_metrics.py
   python populate_metrics.py
   ```

## Archive

The `_archive_onetime/` folder contains one-time migration and test scripts that are no longer needed for production use. These are kept for historical reference but should not be run on a new installation.
