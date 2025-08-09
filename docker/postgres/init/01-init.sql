-- Initialize SmartThreads Database
-- This script runs on first container startup

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'editor', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_status AS ENUM ('active', 'inactive', 'error', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE post_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Set default timezone
SET timezone = 'Asia/Tokyo';

-- Create indexes for better performance
-- Note: These will be created automatically by TypeORM entities,
-- but we can add custom composite indexes here if needed

-- Grant permissions (for production, adjust as needed)
GRANT ALL PRIVILEGES ON DATABASE smartthreads_db TO smartthreads;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO smartthreads;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO smartthreads;

-- Create initial admin user (development only)
-- Password: admin123 (bcrypt hash)
-- This should be removed or changed in production
INSERT INTO users (
    id,
    name,
    email,
    password,
    role,
    timezone,
    language,
    "isActive",
    "twoFactorEnabled",
    "notificationSettings",
    "createdAt",
    "updatedAt"
) VALUES (
    uuid_generate_v4(),
    'Admin User',
    'admin@smartthreads.local',
    '$2b$10$YV1aZ7JZvM6K5IxPZJ6Qs.hEqWwRxbqJXxvqbI0hGcNvUhRx6Zz0y',
    'admin',
    'Asia/Tokyo',
    'ja',
    true,
    false,
    '{"email": true, "push": false, "tokenExpiry72h": true, "tokenExpiry24h": true, "tokenExpiry1h": true, "scheduleSuccess": true, "scheduleFailure": true}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT DO NOTHING;