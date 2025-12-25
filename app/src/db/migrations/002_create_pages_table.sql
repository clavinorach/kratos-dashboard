-- Migration: Create Pages Table for Markdown CMS
-- Description: Stores markdown pages with role-based access control

-- Create pages table
CREATE TABLE IF NOT EXISTS pages (
    id SERIAL PRIMARY KEY,
    
    -- URL-safe slug (lowercase alphanumeric and hyphens only)
    slug VARCHAR(255) NOT NULL UNIQUE,
    
    -- Page metadata
    title VARCHAR(255) NOT NULL,
    
    -- Raw markdown content
    content TEXT NOT NULL,
    
    -- Role-based access control (PostgreSQL array of user_role enum)
    allowed_roles user_role[] NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add constraint to ensure slug format (lowercase alphanumeric and hyphens)
ALTER TABLE pages ADD CONSTRAINT pages_slug_format 
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

-- Create index on slug for faster lookups
CREATE INDEX idx_pages_slug ON pages(slug);

-- Create index on allowed_roles for role-based queries
CREATE INDEX idx_pages_allowed_roles ON pages USING GIN(allowed_roles);

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pages_updated_at
    BEFORE UPDATE ON pages
    FOR EACH ROW
    EXECUTE FUNCTION update_pages_updated_at();

-- Add comment to table
COMMENT ON TABLE pages IS 'Stores markdown pages with role-based access control';
COMMENT ON COLUMN pages.slug IS 'URL-safe identifier (lowercase alphanumeric and hyphens only)';
COMMENT ON COLUMN pages.content IS 'Raw markdown content (not HTML)';
COMMENT ON COLUMN pages.allowed_roles IS 'Array of roles that can access this page';
