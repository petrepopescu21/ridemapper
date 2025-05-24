-- Initialize RideMapper database
-- This file is run when the PostgreSQL container starts for the first time

-- Create extensions that might be useful
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Set timezone
SET timezone = 'UTC';

-- Create additional indexes for performance (will be applied after Prisma schema)
-- These will be created via Prisma migrations, but this file ensures extensions are available 