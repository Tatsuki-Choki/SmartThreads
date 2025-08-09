-- SmartThreads Database Initialization Script

-- Create database if not exists (run as superuser)
-- CREATE DATABASE smartthreads;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone
SET timezone = 'Asia/Tokyo';

-- Create initial schema comment
COMMENT ON DATABASE smartthreads IS 'SmartThreads - Threads Post Management System';

-- Note: Tables will be created automatically by TypeORM migrations