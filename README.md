# Visual Analytics for Yelp Business Performance

A web application for exploring and analyzing Yelp business data using interactive maps, scatter plots, and timeline visualizations. Built with React, FastAPI, and PostgreSQL.

## Prerequisites

### Database Setup

The SQL database dump is too large for GitHub and must be downloaded separately from Google Drive:

1. Download `database_dump.sql` from [https://drive.google.com/drive/folders/1JVCChkcpI7cXFWG2Wi-FAGKn-GooqRGe?usp=sharing]
2. Place the file in the `backend/` directory: `Visual-Analytics-for-Yelp-Business-Performance/backend/database_dump.sql`

This file is required for both Docker and manual installation methods.

## Quick Start (Docker)

Once you have downloaded the database dump file, clone and run:

```bash
git clone git@github.com:FerzendeSh/Visual-Analytics-for-Yelp-Business-Performance.git
cd Visual-Analytics-for-Yelp-Business-Performance
docker-compose up
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- API Documentation: http://localhost:8080/docs

The database automatically initializes from `backend/database_dump.sql` on first run.

### Requirements
- Docker Desktop installed and running
- `database_dump.sql` downloaded from Google Drive (see Prerequisites above)
- No original Yelp dataset files needed
- No manual database setup required

### Useful Docker Commands

```bash
# Run in background
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild after code changes
docker-compose up --build
```

## Manual Installation (Without Docker)

**Backend:**
```bash
cd backend
pip install -r requirements.txt

# Create PostgreSQL database
createdb yelp_analytics
psql -d yelp_analytics -f database_dump.sql

# Configure environment
cp ../.env backend/.env
# Edit backend/.env and update DATABASE_URL if needed

# Run server
uvicorn server:app --host 0.0.0.0 --port 8080
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Using the Application

### Getting Started

1. Open http://localhost:3000
2. You'll see two modes: **Scanner** (default) and **Comparison**

### Scanner Mode

The main exploration interface with map and scatter plot visualization.

**Map Features:**
- Interactive map showing all businesses in the current viewport
- Zoom and pan to explore different areas
- Businesses appear as markers that cluster automatically when zoomed out
- Click any business marker to select it

**Filters & Search:**
- **City/State**: Filter businesses by location
- **Search Bar**: Search for specific business types (e.g., "Restaurants", "Coffee"), names, cities
- **Min Rating**: Filter by star rating (1-5)
- **Open Status**: Show only open businesses
- **Neighborhood**: Filter by neighborhood name
- **Competitor Group**: View businesses from a specific competitor group


**Scatter Plot (Competitive Positioning):**
- Each dot is a business - see how they compare
- Hover over dots to see business names
- Shows the same businesses currently visible on the map or based on filters if selected

**Metrics Cards:**
- Our bussineses metrics
- average sentiment, average rating, review counts

### Comparison Mode

Deep analysis of individual businesses with timeline charts.

**Select Businesses:**
- Add up to 3 comparison businesses
- Toggle benchmarks: City Average, Neighborhood Average, competitor group avg

**Timeline Charts:**

1. **Rating Trends**
   - Historical star ratings over time
   - Monthly or yearly aggregation
   - Compare your business against competitors and benchmarks
   - Brush selection to zoom into specific time periods
   - Click on year bars to drill down to monthly view

2. **Sentiment Trends**
   - Shows review volume and sentiment ratios

3. **Keywords Plot**
   - Visualizes frequently mentioned keywords from business reviews
   - Shows keyword frequency and sentiment associations
   - Helps identify what customers talk about most
   - Click any keyword to open a drawer showing actual reviews mentioning that keyword

4. **Business Attributes**
   - Table comparing business features
   - Attributes like parking, ambiance, price range, etc.

**Time Controls:**
- Brush on charts to select custom date ranges

### API Endpoints

Backend REST API at http://localhost:8080

**Business Endpoints:**
- `GET /api/businesses/viewport` - Get businesses in map viewport
- `GET /api/businesses/search` - Search businesses by name
- `GET /api/businesses/{id}` - Get business details

**Cluster Endpoints:**
- `GET /api/clusters/catalog` - List available cluster runs
- `GET /api/clusters/viewport` - Get clusters in map viewport
- `GET /api/clusters/{id}` - Get cluster details with member businesses

**Analytics Endpoints:**
- `POST /api/analytics/batch-timelines` - Get timeline data for multiple businesses
- `GET /api/analytics/business/{id}/combined-timeline` - Get ratings and sentiment timelines

**Location Endpoints:**
- `GET /api/locations/cities` - List all cities
- `GET /api/locations/states` - List all states

Full API docs with request/response schemas: http://localhost:8080/docs

## Technology Stack

**Frontend:** React 19, TypeScript, Vite, TailwindCSS, Zustand, React Query, MapLibre GL, Deck.gl, Visx

**Backend:** FastAPI, SQLAlchemy, PostgreSQL, Pydantic, Alembic

**Data & ML:**  spaCy, Pandas, GeoPandas