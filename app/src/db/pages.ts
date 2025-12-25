/**
 * Pages Data Access Layer
 * 
 * Handles all database operations for the markdown CMS pages.
 * Enforces role-based access control using PostgreSQL array operations.
 */

import { pool } from './client';

/**
 * Represents a page in the CMS
 */
export interface Page {
  id: number;
  slug: string;
  title: string;
  content: string;
  allowed_roles: string[];
  created_at: Date;
  updated_at: Date;
}

/**
 * Data for creating a new page
 */
export interface CreatePageData {
  slug: string;
  title: string;
  content: string;
  allowed_roles: string[];
}

/**
 * Data for updating an existing page
 */
export interface UpdatePageData {
  slug?: string;
  title?: string;
  content?: string;
  allowed_roles?: string[];
}

/**
 * Validates slug format (lowercase alphanumeric and hyphens only).
 * 
 * @param slug - The slug to validate
 * @throws Error if slug format is invalid
 */
function validateSlug(slug: string): void {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugRegex.test(slug)) {
    throw new Error(
      'Invalid slug format. Use lowercase letters, numbers, and hyphens only (e.g., "my-page-title")'
    );
  }
}

/**
 * Gets all pages accessible by a specific user role.
 * 
 * Uses PostgreSQL array overlap operator (&&) to check if the user's
 * role is in the page's allowed_roles array.
 * 
 * @param userRole - The user's role ('admin' or 'user')
 * @returns Array of pages accessible by the role
 */
export async function getAllPages(userRole: string): Promise<Page[]> {
  const result = await pool.query<Page>(
    `SELECT id, slug, title, content, allowed_roles, created_at, updated_at
     FROM pages
     WHERE allowed_roles && ARRAY[$1::user_role]
     ORDER BY created_at DESC`,
    [userRole]
  );
  return result.rows;
}

/**
 * Gets all pages (admin only - no role filtering).
 * 
 * @returns Array of all pages
 */
export async function getAllPagesAdmin(): Promise<Page[]> {
  const result = await pool.query<Page>(
    `SELECT id, slug, title, content, allowed_roles, created_at, updated_at
     FROM pages
     ORDER BY created_at DESC`
  );
  return result.rows;
}

/**
 * Gets a single page by slug.
 * 
 * @param slug - The page slug
 * @returns The page or null if not found
 */
export async function getPageBySlug(slug: string): Promise<Page | null> {
  const result = await pool.query<Page>(
    `SELECT id, slug, title, content, allowed_roles, created_at, updated_at
     FROM pages
     WHERE slug = $1`,
    [slug]
  );
  return result.rows[0] || null;
}

/**
 * Gets a single page by ID.
 * 
 * @param id - The page ID
 * @returns The page or null if not found
 */
export async function getPageById(id: number): Promise<Page | null> {
  const result = await pool.query<Page>(
    `SELECT id, slug, title, content, allowed_roles, created_at, updated_at
     FROM pages
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Creates a new page.
 * 
 * Validates slug format before insertion. Admin only.
 * 
 * @param data - Page creation data
 * @returns The created page
 * @throws Error if slug is invalid or already exists
 */
export async function createPage(data: CreatePageData): Promise<Page> {
  validateSlug(data.slug);

  try {
    const result = await pool.query<Page>(
      `INSERT INTO pages (slug, title, content, allowed_roles)
       VALUES ($1, $2, $3, $4)
       RETURNING id, slug, title, content, allowed_roles, created_at, updated_at`,
      [data.slug, data.title, data.content, data.allowed_roles]
    );
    return result.rows[0];
  } catch (error: any) {
    if (error.code === '23505') {
      // Unique violation
      throw new Error(`Page with slug "${data.slug}" already exists`);
    }
    throw error;
  }
}

/**
 * Updates an existing page.
 * 
 * Validates slug format if slug is being updated. Admin only.
 * 
 * @param id - The page ID
 * @param data - Page update data
 * @returns The updated page or null if not found
 * @throws Error if slug is invalid or already exists
 */
export async function updatePage(
  id: number,
  data: UpdatePageData
): Promise<Page | null> {
  if (data.slug !== undefined) {
    validateSlug(data.slug);
  }

  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.slug !== undefined) {
    updates.push(`slug = $${paramIndex++}`);
    values.push(data.slug);
  }
  if (data.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    values.push(data.title);
  }
  if (data.content !== undefined) {
    updates.push(`content = $${paramIndex++}`);
    values.push(data.content);
  }
  if (data.allowed_roles !== undefined) {
    updates.push(`allowed_roles = $${paramIndex++}`);
    values.push(data.allowed_roles);
  }

  if (updates.length === 0) {
    // No updates to perform
    return getPageById(id);
  }

  values.push(id);

  try {
    const result = await pool.query<Page>(
      `UPDATE pages
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, slug, title, content, allowed_roles, created_at, updated_at`,
      values
    );
    return result.rows[0] || null;
  } catch (error: any) {
    if (error.code === '23505') {
      // Unique violation
      throw new Error(`Page with slug "${data.slug}" already exists`);
    }
    throw error;
  }
}

/**
 * Deletes a page.
 * 
 * Admin only.
 * 
 * @param id - The page ID
 * @returns True if deleted, false if not found
 */
export async function deletePage(id: number): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM pages WHERE id = $1',
    [id]
  );
  return (result.rowCount || 0) > 0;
}
