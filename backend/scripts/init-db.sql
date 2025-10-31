-- Initialize database for Yelp Analytics
-- This script runs when the PostgreSQL container is first created

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For better text search performance

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE yelp_analytics TO yelp_user;

-- Create schema comments
COMMENT ON DATABASE yelp_analytics IS 'Yelp Business Performance Analytics Database';
