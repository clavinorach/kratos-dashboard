# Ory Kratos OAuth + Role-Based Markdown CMS

<<<<<<< HEAD
![WhatsApp Image 2025-12-16 at 14 17 31](https://github.com/user-attachments/assets/78200ab2-350e-4717-9b77-d60f65c77a52)
![WhatsApp Image 2025-12-16 at 14 17 52](https://github.com/user-attachments/assets/790db16e-ebbb-477c-936a-38d9e8b6ecdb)



A complete authentication system using **Ory Kratos** with **GitLab OAuth (OIDC)**, featuring a Node.js/Express backend with application-level role-based access control (RBAC).

### Component Responsibilities

| Component | Owns | Does NOT Own |
|-----------|------|--------------|
| **Ory Kratos** | Identity storage, Sessions, GitLab OIDC flows, Email verification | Roles, Permissions |
| **Application** | Role management, Authorization, Business logic | Authentication, Session tokens |
| **Kratos UI** | Login, Registration, Settings, Recovery UI | Role-based UI |
=======
Authentication system with GitLab/Google OAuth, role-based access control, and markdown page management.

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

Edit the file with your OAuth credentials. See [Environment Variables Reference](#environment-variables-reference) for detailed documentation.

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

## Environment Variables Reference

### Network Configuration

| Variable | Description | Local | Production |
|----------|-------------|-------|------------|
| `DOMAIN` | Cookie domain for sessions | `127.0.0.1` | VM IP or domain |

### Database

| Variable | Description | Example |
|----------|-------------|----------|
| `POSTGRES_USER` | PostgreSQL username | `postgres` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `secret`  Change in production |
| `POSTGRES_MULTIPLE_DATABASES` | Databases to create | `kratos,app` |
| `KRATOS_DSN` | Kratos database connection | `postgres://user:pass@postgres:5432/kratos?sslmode=disable` |
| `APP_DATABASE_URL` | App database connection | `postgres://user:pass@postgres:5432/app?sslmode=disable` |

### Secrets

 **CRITICAL**: Generate new random secrets for production!

```bash
# Generate secure secrets
openssl rand -base64 32
```

| Variable | Description | Local | Production |
|----------|-------------|-------|------------|
| `KRATOS_SECRETS_COOKIE` | Kratos cookie encryption | Insecure placeholder | `openssl rand -base64 32` |
| `KRATOS_SECRETS_CIPHER` | Kratos cipher key | Insecure placeholder | `openssl rand -base64 32` |
| `SESSION_SECRET` | Express session secret | Insecure placeholder | `openssl rand -base64 32` |

### OAuth Providers

#### GitLab

| Variable | Description |
|----------|-------------|
| `GITLAB_CLIENT_ID` | GitLab Application ID |
| `GITLAB_CLIENT_SECRET` | GitLab Application Secret |

**Redirect URIs:**
- Local: `http://127.0.0.1:4433/self-service/methods/oidc/callback/gitlab`
- Production: `http://YOUR_VM_IP:4433/self-service/methods/oidc/callback/gitlab`
- HTTPS: `https://auth.yourdomain.com/self-service/methods/oidc/callback/gitlab`

#### Google

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |

**Redirect URIs:**
- Local: `http://127.0.0.1:4433/self-service/methods/oidc/callback/google`
- Production: `http://YOUR_VM_IP:4433/self-service/methods/oidc/callback/google`
- HTTPS: `https://auth.yourdomain.com/self-service/methods/oidc/callback/google`

### Service URLs

#### Internal URLs (Docker Network)

These remain the same for local and production:

| Variable | Value | Description |
|----------|-------|-------------|
| `KRATOS_PUBLIC_URL_INTERNAL` | `http://kratos:4433` | Internal Kratos public API |
| `KRATOS_ADMIN_URL_INTERNAL` | `http://kratos:4434` | Internal Kratos admin API |

#### External URLs (Browser Access)

**Local Development:**

| Variable | Value |
|----------|-------|
| `KRATOS_BROWSER_URL` | `http://127.0.0.1:4433` |
| `KRATOS_UI_URL` | `http://127.0.0.1:4455` |
| `APP_URL` | `http://127.0.0.1:3000` |

**Production (VM with External IP):**

Replace `YOUR_VM_IP` with your VM's external IP (e.g., `203.0.113.45`):

| Variable | Value |
|----------|-------|
| `KRATOS_BROWSER_URL` | `http://YOUR_VM_IP:4433` |
| `KRATOS_UI_URL` | `http://YOUR_VM_IP:4455` |
| `APP_URL` | `http://YOUR_VM_IP:3000` |
| `DOMAIN` | `YOUR_VM_IP` |

**Production (Domain with HTTPS - Recommended):**

| Variable | Example |
|----------|----------|
| `KRATOS_BROWSER_URL` | `https://auth.yourdomain.com` |
| `KRATOS_UI_URL` | `https://login.yourdomain.com` |
| `APP_URL` | `https://app.yourdomain.com` |
| `DOMAIN` | `yourdomain.com` |

### Production Checklist

- [ ] Update `DOMAIN` to your VM IP or domain
- [ ] Generate new `KRATOS_SECRETS_COOKIE` using `openssl rand -base64 32`
- [ ] Generate new `KRATOS_SECRETS_CIPHER` using `openssl rand -base64 32`
- [ ] Generate new `SESSION_SECRET` using `openssl rand -base64 32`
- [ ] Change `POSTGRES_PASSWORD` to a strong password
- [ ] Update OAuth redirect URIs in GitLab/Google consoles with production URLs
- [ ] Set external URLs (`KRATOS_BROWSER_URL`, `KRATOS_UI_URL`, `APP_URL`)
- [ ] Use HTTPS in production (highly recommended)
- [ ] Configure firewall to allow ports: `3000`, `4433`, `4434`, `4455`
- [ ] Set up reverse proxy (nginx/Caddy) for HTTPS
- [ ] Configure SSL certificates (Let's Encrypt recommended)

### VM Deployment Example

For a VM with external IP `203.0.113.45`:

```bash
# .env file
DOMAIN=203.0.113.45

# Secrets (generate new ones!)
KRATOS_SECRETS_COOKIE=X8k2Jm9LpQzRn3+sT5vWdHgY7uJkMpTnVbXc2eRq1w=
KRATOS_SECRETS_CIPHER=Y9l3Kn0MqRzSo4+tU6wXeIhZ8vKlNqUnWcYd3fSr2x=
SESSION_SECRET=Z0m4Lo1NrSzTp5+uV7xYfJiA9wLmOrVoXdZe4gTt3y=
POSTGRES_PASSWORD=your-strong-password-here

# OAuth (update redirect URIs in consoles)
GITLAB_CLIENT_ID=your_actual_gitlab_id
GITLAB_CLIENT_SECRET=your_actual_gitlab_secret
GOOGLE_CLIENT_ID=your_actual_google_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_actual_google_secret

# External URLs
KRATOS_BROWSER_URL=http://203.0.113.45:4433
KRATOS_UI_URL=http://203.0.113.45:4455
APP_URL=http://203.0.113.45:3000
```

Don't forget to update OAuth redirect URIs:
- GitLab: `http://203.0.113.45:4433/self-service/methods/oidc/callback/gitlab`
- Google: `http://203.0.113.45:4433/self-service/methods/oidc/callback/google`

## License

MIT
