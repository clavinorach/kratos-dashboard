-- Seed Script: Promote the first registered user to ADMIN
-- 
-- Usage:
--   1. First, register a user via the UI (GitLab OAuth)
--   2. Find the identity_id from Kratos:
--      docker compose exec postgres psql -U postgres -d kratos -c "SELECT id, traits FROM identities;"
--   3. Copy the identity UUID and run this script with that ID
--
-- Option A: Replace <IDENTITY_UUID> and run directly
-- docker compose exec postgres psql -U postgres -d app -c "INSERT INTO user_roles (identity_id, role) VALUES ('<IDENTITY_UUID>', 'admin') ON CONFLICT (identity_id) DO UPDATE SET role = 'admin';"

-- Option B: Use this SQL file after editing the UUID below
-- docker compose exec postgres psql -U postgres -d app -f /scripts/seed-admin.sql

-- IMPORTANT: Replace this UUID with the actual identity_id from Kratos
-- You can find it by running:
-- docker compose exec postgres psql -U postgres -d kratos -c "SELECT id, traits FROM identities LIMIT 5;"

DO $$
DECLARE
    admin_identity_id UUID := 'REPLACE-WITH-YOUR-IDENTITY-UUID';
BEGIN
    -- Check if a valid UUID was provided
    IF admin_identity_id = 'REPLACE-WITH-YOUR-IDENTITY-UUID'::UUID THEN
        RAISE EXCEPTION 'Please replace the placeholder UUID with an actual identity_id from Kratos';
    END IF;

    -- Insert or update the user role to admin
    INSERT INTO user_roles (identity_id, role)
    VALUES (admin_identity_id, 'admin')
    ON CONFLICT (identity_id) 
    DO UPDATE SET role = 'admin', updated_at = NOW();
    
    RAISE NOTICE 'Successfully promoted identity % to admin', admin_identity_id;
END $$;

-- Alternative: Quick one-liner (uncomment and replace UUID)
-- INSERT INTO user_roles (identity_id, role) VALUES ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', 'admin') ON CONFLICT (identity_id) DO UPDATE SET role = 'admin';
