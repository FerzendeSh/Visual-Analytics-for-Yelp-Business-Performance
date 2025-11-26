# Database Setup Scripts

This directory contains scripts for setting up and populating the Yelp Business Performance database from scratch. **Scripts are numbered in execution order** for easy setup.

## Prerequisites

- PostgreSQL database running and configured in `.env`
- Python environment with all dependencies installed
- JSON data files in `backend/data/`:
  - `subset_businesses.json`
  - `subset_photos.json`
  - `reviews_complete.json`
- **Pre-processed GeoJSON files in `backend/public/`** (should already exist):
  - `backend/public/neighborhoods/` - Neighborhood boundaries by city
  - `backend/public/cities/` - City boundaries

---

## Setup Order for Fresh Database

### Step 0: Database Migrations

Before running any scripts, create the database schema:

```bash
cd backend
alembic upgrade head
```

**What this does:**
- Creates core tables: `businesses`, `photos`, `reviews`
- Adds indexes for performance
- Adds `neighborhood` column to businesses
- Creates metrics tables

**Migrations run in order:**
1. `7907ddabd6f3` - Initial tables (businesses, photos)
2. `16a023295c6a` - Change categories to TEXT type
3. `40900a1eaa6d` - Add trigram extension for fuzzy search
4. `10f6fd511a8d` - Add reviews table
5. `d778b231cbce` - Add neighborhood column
6. `b951debc1899` - Add neighborhood metrics table

---

### Step 1: Load Initial Data

**Script:** `01_seed_initial_data.py`

Loads core business data from JSON files.

**What it does:**
- Loads businesses, photos, and reviews
- Handles JSON and NDJSON formats
- Skips duplicates and validates relationships
- Commits in batches for performance

**Usage:**
```bash
python -m scripts.01_seed_initial_data
```

**Expected output:**
- X businesses inserted
- Y photos inserted
- Z reviews inserted

---

### Step 2: Normalize City Names (Optional)

**Script:** `02_normalize_city_names.py`

Fixes inconsistent city name spellings.

**What it does:**
- Normalizes city variations (e.g., "Saint Louis" → "St. Louis")
- Creates backup before changes
- Reports all changes made

**Usage:**
```bash
# Preview changes (recommended first)
python -m scripts.02_normalize_city_names --dry-run

# Apply changes
python -m scripts.02_normalize_city_names
```

**Required:** `city_normalization_map.json` in scripts directory

**Note:** Only needed once, or when you discover new city name inconsistencies

---

### Step 3: Assign Neighborhoods to Businesses (Optional)

**Script:** `03_assign_neighborhoods.py`

Assigns neighborhood names to businesses using spatial joins with city-specific GeoJSON files.

**What it does:**
- Reads neighborhood boundaries from `backend/public/neighborhoods/`
- Spatially matches each business to its neighborhood (point-in-polygon)
- Updates `neighborhood` column in businesses table
- Processes city-by-city for all states
- Handles both Zillow data (NAME property) and census-generated data (neighborhood property)

**Usage:**
```bash
# Preview changes (recommended first)
python scripts/03_assign_neighborhoods.py --dry-run

# Apply changes
python scripts/03_assign_neighborhoods.py

# Custom batch size
python scripts/03_assign_neighborhoods.py --batch-size 200
```

**When to run:**
- After initial data load (Step 1)
- When adding new business data
- After updating neighborhood GeoJSON files
- If neighborhood assignments need correction

**Note:** Businesses outside all neighborhood polygons will not be assigned a neighborhood (they keep their current value or NULL).

---

### Step 4: Compute Neighborhood Metrics (Optional)

**Script:** `04_compute_neighborhood_metrics.py`

Pre-computes neighborhood analytics for fast queries.

**What it does:**
- Aggregates reviews by neighborhood, month, year
- Calculates avg ratings, sentiment scores, counts
- Populates `neighborhood_timeline_metrics` table

**Usage:**
```bash
python scripts/04_compute_neighborhood_metrics.py
```

**Prerequisites:**
- Step 3 completed (neighborhoods assigned)
- `neighborhood_timeline_metrics` table exists

---

### Step 5: Create Metrics Tables (Optional)

**Script:** `05_create_metrics_tables.py`

Creates additional pre-computed metrics tables.

**What it does:**
- Creates 5 metrics tables:
  - `business_timeline_metrics`
  - `city_timeline_metrics`
  - `state_timeline_metrics`
  - `city_category_timeline_metrics`
  - `state_category_timeline_metrics`

**Usage:**
```bash
python scripts/05_create_metrics_tables.py
```

**Note:** Only needed if tables don't exist. Check with `\dt` in psql.

---

### Step 6: Populate Metrics Tables (Optional)

**Script:** `06_populate_metrics.py`

Populates all metrics tables with aggregated data.

**What it does:**
- Aggregates by business, city, state, categories
- Creates monthly and yearly metrics
- Processes in batches

**Usage:**
```bash
python scripts/06_populate_metrics.py
```

**Prerequisites:**
- Step 5 completed (tables exist)
- Reviews loaded (Step 1)

**Note:** Can take several minutes for large datasets

---

## Quick Start: Minimal Setup

For basic database with just business data:

```bash
# 1. Run migrations
alembic upgrade head

# 2. Load data
python -m scripts.01_seed_initial_data
```

---

## Full Setup: Complete Analytics Pipeline

For full analytics with neighborhoods and metrics:

```bash
# 0. Migrations
alembic upgrade head

# 1-2. Core data and normalization
python -m scripts.01_seed_initial_data
python -m scripts.02_normalize_city_names

# 3-6. Neighborhood assignment and metrics
python scripts/03_assign_neighborhoods.py
python scripts/04_compute_neighborhood_metrics.py
python scripts/05_create_metrics_tables.py
python scripts/06_populate_metrics.py
```

---

## Adding New Business Data

If you add new businesses to your JSON files:

```bash
# 1. Seed new data (skips existing records)
python -m scripts.01_seed_initial_data

# 2. Assign neighborhoods to new businesses
python scripts/03_assign_neighborhoods.py

# 3. Recompute metrics with new data
python scripts/04_compute_neighborhood_metrics.py
python scripts/06_populate_metrics.py
```

---

## Directory Structure

### Main Scripts (Run in Order)
- `01_seed_initial_data.py` - Load businesses, photos, reviews
- `02_normalize_city_names.py` - Fix city name inconsistencies (one-time)
- `03_assign_neighborhoods.py` - Assign neighborhoods to businesses
- `04_compute_neighborhood_metrics.py` - Pre-compute neighborhood analytics
- `05_create_metrics_tables.py` - Create metrics tables (one-time)
- `06_populate_metrics.py` - Populate all metrics tables

### Preprocessing Scripts (One-Time Use)
- `_preprocessing/` - Scripts for generating GeoJSON files from raw data
  - `03_process_geojson_boundaries.py` - Process Zillow & Census boundaries
  - `04_generate_census_neighborhoods.py` - Generate fallback neighborhoods
  - **Only run these if you have new raw source data**

### Data Directories
- `neighborhood-GeoJSON/` - Raw Zillow neighborhood boundaries (source data)
- `cities/` - Raw US Census city boundaries (source data)
- `neighborhood_data/census_tracts/` - Raw Census tract shapefiles (source data)
- `_archive_onetime/` - Historical migration scripts (reference only)

---

## Troubleshooting

**"Table already exists" errors:**
- Check migrations: `alembic current`
- Check tables: `psql -d your_db -c "\dt"`

**"File not found" errors:**
- Ensure JSON files in `backend/data/`
- Ensure GeoJSON files in correct directories

**"Foreign key violation" errors:**
- Run scripts in numbered order
- Step 1 must complete successfully first

**Slow performance:**
- Metrics scripts (6-8) take time on large datasets
- Consider smaller batch sizes for testing

---

## Database Reset

To completely reset and rebuild:

```bash
# Drop all tables
alembic downgrade base

# Recreate schema
alembic upgrade head

# Re-run data loading
python -m scripts.01_seed_initial_data
# ... continue with other scripts as needed
```
