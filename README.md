# Ory Kratos OAuth + Role-Based Markdown CMS

<img width="561" height="387" alt="image" src="https://github.com/user-attachments/assets/3c3603fc-72ba-48f1-93af-76454c696011" />
<img width="586" height="422" alt="image" src="https://github.com/user-attachments/assets/1d5177b8-1a63-489e-b36c-ea8bd57696b1" />

A complete authentication system using **Ory Kratos** with **GitLab OAuth (OIDC)**, featuring a Node.js/Express backend with application-level role-based access control (RBAC).

### Component Responsibilities

| Component | Owns | Does NOT Own |
|-----------|------|--------------|
| **Ory Kratos** | Identity storage, Sessions, GitLab OIDC flows, Email verification | Roles, Permissions |
| **Application** | Role management, Authorization, Business logic | Authentication, Session tokens |
| **Kratos UI** | Login, Registration, Settings, Recovery UI | Role-based UI |
=======
Authentication system with GitLab/Google OAuth, role-based access control, and markdown page management.oc

## Prerequisites

- Docker & Docker Compose

## OAuth Configuration

### GitLab OAuth Application

1. Go to **GitLab** → **User Settings** → **Applications**
2. Create new application with:
   - **Redirect URI**: `http://127.0.0.1:4433/self-service/methods/oidc/callback/gitlab`
   - **Scopes**: `openid`, `profile`, `email`
3. Copy **Application ID** and **Secret**

### Google OAuth Application

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. Create **OAuth 2.0 Client ID** with:
   - **Application type**: Web application
   - **Authorized redirect URI**: `http://127.0.0.1:4433/self-service/methods/oidc/callback/google`
3. Copy **Client ID** and **Client Secret**

### Environment Variables

Create `.env` file:

```bash
cp .env.example .env
```

Required variables:

```bash
# GitLab OAuth
GITLAB_CLIENT_ID=your_gitlab_application_id
GITLAB_CLIENT_SECRET=your_gitlab_secret

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Database
POSTGRES_PASSWORD=secret
KRATOS_DSN=postgres://postgres:secret@postgres:5432/kratos?sslmode=disable
APP_DATABASE_URL=postgres://postgres:secret@postgres:5432/app?sslmode=disable

# Secrets (change in production)
KRATOS_SECRETS_COOKIE=PLEASE-CHANGE-ME-I-AM-VERY-INSECURE
KRATOS_SECRETS_CIPHER=32-LONG-SECRET-NOT-SECURE-AT-ALL
SESSION_SECRET=change-this-super-secret-session-key
```

## Quick Start

### 1. Start Services

```bash
docker compose up -d
```

Wait 30-60 seconds for all services to initialize.

### 2. Initialize Database

Create the pages table:

```bash
docker compose exec postgres psql -U postgres -d app << 'EOF'
CREATE TYPE user_role AS ENUM ('admin', 'user');

CREATE TABLE IF NOT EXISTS pages (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    allowed_roles user_role[] NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT pages_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE INDEX idx_pages_slug ON pages(slug);
CREATE INDEX idx_pages_allowed_roles ON pages USING GIN(allowed_roles);

CREATE OR REPLACE FUNCTION update_pages_updated_at()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pages_updated_at
    BEFORE UPDATE ON pages
    FOR EACH ROW
    EXECUTE FUNCTION update_pages_updated_at();
EOF
```

### 3. Bootstrap First Admin

1. Login via Google or GitLab at http://127.0.0.1:3000
2. Get your identity ID:

```bash
docker compose exec postgres psql -U postgres -d kratos -c "SELECT id, traits->>'email' FROM identities;"
```

3. Promote to admin (replace `YOUR-IDENTITY-UUID`):

```bash
docker compose exec postgres psql -U postgres -d app -c \
  "INSERT INTO user_roles (identity_id, role) VALUES ('YOUR-IDENTITY-UUID', 'admin') ON CONFLICT (identity_id) DO UPDATE SET role = 'admin';"
```

4. Refresh browser to see admin dashboard

## Service Access Points

| Service | URL |
|---------|-----|
| Application | http://127.0.0.1:3000 |
| Auth UI | http://127.0.0.1:4455 |
| Kratos Public API | http://127.0.0.1:4433 |
| Kratos Admin API | http://127.0.0.1:4434 |
| MailSlurper (Email Testing) | http://127.0.0.1:4436 |

## API Endpoints

### Authentication

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/me` | GET | Session | Current user info + role |
| `/logout` | GET | Session | Logout |

### Page Management

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/p` | GET | User | List accessible pages |
| `/p/:slug` | GET | User | View page (role-checked) |
| `/admin/pages` | GET | Admin | List all pages (JSON) |
| `/admin/pages/new` | GET | Admin | Page editor (HTML) |
| `/admin/pages/:id/edit` | GET | Admin | Page editor (HTML) |
| `/admin/pages` | POST | Admin | Create page |
| `/admin/pages/:id` | PUT | Admin | Update page |
| `/admin/pages/:id` | DELETE | Admin | Delete page |

### User Management

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/admin/users` | GET | Admin | List all users |
| `/admin/users/:id/role` | POST | Admin | Assign role |
| `/admin/users/:id/role` | DELETE | Admin | Remove role |

## Database Access

```bash
# View identities
docker compose exec postgres psql -U postgres -d kratos -c "SELECT id, traits FROM identities;"

# View user roles
docker compose exec postgres psql -U postgres -d app -c "SELECT * FROM user_roles;"

# View pages
docker compose exec postgres psql -U postgres -d app -c "SELECT id, slug, title, allowed_roles FROM pages;"

# Interactive session
docker compose exec postgres psql -U postgres -d app
```

## Development

### Rebuild and Restart

```bash
docker compose up -d --build
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f kratos
```

### Reset Everything

```bash
docker compose down -v
docker compose up -d
```

### Hot Reload

The app container uses `tsx watch` - changes to `app/src/` and `app/views/` auto-reload.

## Common Tasks

### Create a Page

1. Login as admin
2. Navigate to `/admin/pages/new`
3. Fill in title, slug, markdown content, and allowed roles
4. Submit form

Example markdown content:

```markdown
# Welcome

This is a **secure** markdown page with:
- Role-based access control
- XSS protection
- Beautiful rendering

## Code Example

`const x = 42;`
```

### Assign User Role

```bash
# Via API (replace {identity_id} and {role})
curl -X POST http://127.0.0.1:3000/admin/users/{identity_id}/role \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"role": "admin"}'

# Via database
docker compose exec postgres psql -U postgres -d app -c \
  "INSERT INTO user_roles (identity_id, role) VALUES ('{identity_id}', 'user');"
```

### View Email Verification Links

Visit http://127.0.0.1:4436 to see emails sent by Kratos (MailSlurper UI).

## Production Deployment

1. Change all secrets in `.env`
2. Use HTTPS for all OAuth redirect URIs
3. Update callback URLs in GitLab/Google consoles
4. Set proper cookie domain in `kratos/kratos.yml`
5. Use managed PostgreSQL
6. Enable SSL for database connections

## License

MIT
