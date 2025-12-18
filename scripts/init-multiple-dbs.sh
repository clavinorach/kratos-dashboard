#!/bin/bash
# init-multiple-dbs.sh
# This script creates multiple databases in PostgreSQL on container startup
# It also initializes the app database schema

set -e
set -u

function create_user_and_database() {
    local database=$1
    echo "Creating database '$database'"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
        SELECT 'CREATE DATABASE $database'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$database')\gexec
EOSQL
}

# Create databases from POSTGRES_MULTIPLE_DATABASES environment variable
if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
    echo "Multiple database creation requested: $POSTGRES_MULTIPLE_DATABASES"
    for db in $(echo $POSTGRES_MULTIPLE_DATABASES | tr ',' ' '); do
        create_user_and_database $db
    done
    echo "Multiple databases created"
fi

# Initialize the app database schema
echo "Initializing app database schema..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "app" <<-EOSQL
    -- Create enum for user roles
    DO \$\$ BEGIN
        CREATE TYPE user_role AS ENUM ('admin', 'user');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END \$\$;

    -- Create user_roles table
    CREATE TABLE IF NOT EXISTS user_roles (
        id SERIAL PRIMARY KEY,
        identity_id UUID NOT NULL UNIQUE,
        role user_role NOT NULL DEFAULT 'user',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create index for faster lookups
    CREATE INDEX IF NOT EXISTS idx_user_roles_identity_id ON user_roles(identity_id);

    -- Function to update updated_at timestamp
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS \$\$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    \$\$ language 'plpgsql';

    -- Trigger to auto-update updated_at (drop first to avoid conflicts)
    DROP TRIGGER IF EXISTS update_user_roles_updated_at ON user_roles;
    CREATE TRIGGER update_user_roles_updated_at
        BEFORE UPDATE ON user_roles
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
EOSQL

echo "App database schema initialized"

