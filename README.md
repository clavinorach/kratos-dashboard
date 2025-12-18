# Ory Kratos GitLab OAuth App

![WhatsApp Image 2025-12-16 at 14 17 31](https://github.com/user-attachments/assets/78200ab2-350e-4717-9b77-d60f65c77a52)
![WhatsApp Image 2025-12-16 at 14 17 52](https://github.com/user-attachments/assets/790db16e-ebbb-477c-936a-38d9e8b6ecdb)



A complete authentication system using **Ory Kratos** with **GitLab OAuth (OIDC)**, featuring a Node.js/Express backend with application-level role-based access control (RBAC).

### Component Responsibilities

| Component | Owns | Does NOT Own |
|-----------|------|--------------|
| **Ory Kratos** | Identity storage, Sessions, GitLab OIDC flows, Email verification | Roles, Permissions |
| **Application** | Role management, Authorization, Business logic | Authentication, Session tokens |
| **Kratos UI** | Login, Registration, Settings, Recovery UI | Role-based UI |

## Prerequisites

- Docker & Docker Compose
- GitLab account (for creating OAuth Application)
- Node.js 20+ (for local development without Docker)

## Quick Start

### 1. Clone and Configure

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your GitLab OAuth credentials (see GitLab OAuth Setup below)
```

### 2. Create GitLab OAuth Application

1. Go to **GitLab** → **User Settings** (click your avatar → Edit profile)
2. Navigate to **Applications** in the left sidebar
3. Click **Add new application**
4. Fill in the details:
   - **Name**: `Kratos OAuth Dev` (or any name)
   - **Redirect URI**: `http://127.0.0.1:4433/self-service/methods/oidc/callback/gitlab`
   - **Confidential**: Yes (checked)
   - **Scopes**: Select `openid`, `profile`, `email`
5. Click **Save application**
6. Copy the **Application ID** and **Secret**
7. Add to your `.env` file:
   ```
   GITLAB_CLIENT_ID=your_application_id_here
   GITLAB_CLIENT_SECRET=your_secret_here
   ```

> **Note**: For self-hosted GitLab instances, you may need to update the `issuer_url` in `kratos/kratos.yml` from `https://gitlab.com` to your GitLab instance URL.

### 3. Start Services

```bash
docker compose up -d
```

Wait for all services to be healthy (30-60 seconds on first run).

### 4. Access the Application

- **Application**: http://127.0.0.1:3000
- **Auth UI (Login/Register)**: http://127.0.0.1:4455
- **Kratos Public API**: http://127.0.0.1:4433
- **Kratos Admin API**: http://127.0.0.1:4434
- **MailSlurper (Email UI)**: http://127.0.0.1:4436

## User Flows

### Registration via GitLab

1. Visit http://127.0.0.1:3000 → redirected to login
2. Click **Sign up** → **Sign in with GitLab**
3. Authorize the application on GitLab
4. Redirected back to app with "Pending Approval" message
5. Wait for admin to assign a role

### First Admin Setup (Bootstrap)

After registering the first user via GitLab:

```bash
# 1. Find the identity ID from Kratos
docker compose exec postgres psql -U postgres -d kratos -c "SELECT id, traits FROM identities;"

# 2. Copy the UUID and promote to admin
docker compose exec postgres psql -U postgres -d app -c \
  "INSERT INTO user_roles (identity_id, role) VALUES ('YOUR-IDENTITY-UUID', 'admin') ON CONFLICT (identity_id) DO UPDATE SET role = 'admin';"
```

### Login Flow

1. Visit http://127.0.0.1:3000
2. Click **Sign in with GitLab**
3. If role assigned → Dashboard
4. If no role → "Pending Approval" page

## API Endpoints

### Public Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/` | GET | Redirect to `/app` |

### Authenticated Endpoints (Session Required)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/me` | GET | Current user info + role |
| `/app` | GET | Main app (role-based routing) |
| `/logout` | GET | Initiate logout via Kratos |

### Admin Endpoints (Admin Role Required)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/users` | GET | List all users with roles |
| `/admin/users/:id` | GET | Get specific user |
| `/admin/users/:id/role` | POST | Assign/update role |
| `/admin/users/:id/role` | DELETE | Remove role (set to pending) |

### Example: Assign Role via API

```bash
# Get all users
curl -b cookies.txt http://127.0.0.1:3000/admin/users

# Assign admin role
curl -X POST http://127.0.0.1:3000/admin/users/{identity_id}/role \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"role": "admin"}'
```

## Database Inspection

### View Kratos Identities

```bash
docker compose exec postgres psql -U postgres -d kratos -c "SELECT id, traits, created_at FROM identities;"
```

### View App Roles

```bash
docker compose exec postgres psql -U postgres -d app -c "SELECT * FROM user_roles;"
```

### Interactive PostgreSQL Session

```bash
# Kratos database
docker compose exec postgres psql -U postgres -d kratos

# App database
docker compose exec postgres psql -U postgres -d app
```

## Configuration Files

### `kratos/kratos.yml`

Main Kratos configuration:
- GitLab OIDC provider configuration
- Self-service flow URLs
- Cookie settings (domain: `127.0.0.1`, SameSite: `Lax`)
- Session lifespan

### `kratos/identity.schema.json`

Identity traits schema:
- `email` (required)
- `name` (full name from GitLab)
- `picture` (avatar URL)

### `kratos/oidc.gitlab.jsonnet`

Jsonnet mapper for GitLab OIDC claims → Kratos traits:

```jsonnet
{
  identity: {
    traits: {
      email: claims.email,
      name: claims.name or claims.nickname or claims.preferred_username,
      picture: claims.picture,
    },
  },
}
```

## Troubleshooting

### Cookies Not Working / Session Issues

**Symptom**: Login succeeds but immediately redirects back to login.

**Solution**: 
- Always use `http://127.0.0.1:PORT` in browser (not `localhost`)
- Check that cookie domain is `127.0.0.1` in `kratos.yml`
- Ensure `same_site: Lax` is set

### CORS Errors

**Symptom**: Browser console shows CORS policy errors.

**Solution**:
- Verify all URLs use `127.0.0.1`
- Check `kratos.yml` CORS configuration includes your origins
- Ensure `allow_credentials: true` is set

### GitLab OAuth Callback Error

**Symptom**: Error after GitLab authorization.

**Solution**:
- Verify redirect URI in GitLab Application: `http://127.0.0.1:4433/self-service/methods/oidc/callback/gitlab`
- Check `GITLAB_CLIENT_ID` and `GITLAB_CLIENT_SECRET` in `.env`
- Ensure Kratos container has access to environment variables
- For self-hosted GitLab: update `issuer_url` in `kratos.yml`

### "Sign in with GitLab" Button Not Showing

**Symptom**: Only password login form appears, no GitLab button.

**Solution**:
- Verify GitLab provider is configured in `kratos.yml` under `selfservice.methods.oidc.config.providers`
- Check that `GITLAB_CLIENT_ID` environment variable is set
- Restart Kratos container: `docker compose restart kratos`

### Database Connection Errors

**Symptom**: App fails to start with database errors.

**Solution**:
```bash
# Check PostgreSQL is running
docker compose ps postgres

# View logs
docker compose logs postgres

# Verify databases exist
docker compose exec postgres psql -U postgres -c "\l"
```

### Kratos Migration Failed

**Symptom**: Kratos won't start, migration errors in logs.

**Solution**:
```bash
# Check migration container logs
docker compose logs kratos-migrate

# Re-run migrations
docker compose up -d kratos-migrate
```

### View Service Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f kratos
docker compose logs -f app
```

## Development

### Local Development (without Docker)

```bash
cd app
npm install
npm run dev
```

Note: Requires Kratos and PostgreSQL to be running (via Docker Compose).

### Hot Reloading

The app container uses `tsx watch` for automatic hot-reloading during development. Changes to files in `app/src/` and `app/views/` are automatically detected.

### Building the App Image

```bash
docker compose build app
```

### Resetting Everything

```bash
# Stop and remove all containers, volumes, networks
docker compose down -v

# Start fresh
docker compose up -d
```

## Service Ports Summary

| Service | Port | URL |
|---------|------|-----|
| PostgreSQL | 5432 | - |
| MailSlurper Web | 4436 | http://127.0.0.1:4436 |
| MailSlurper SMTP | 1025 | - |
| Kratos Public | 4433 | http://127.0.0.1:4433 |
| Kratos Admin | 4434 | http://127.0.0.1:4434 |
| Kratos UI | 4455 | http://127.0.0.1:4455 |
| App Backend | 3000 | http://127.0.0.1:3000 |

## File Structure

```
ory-kratos-oauth/
├── docker-compose.yml          # Service orchestration
├── .env.example                 # Environment template
├── README.md                    # This file
├── kratos/
│   ├── kratos.yml              # Kratos configuration (GitLab OIDC)
│   ├── identity.schema.json    # Identity traits schema
│   └── oidc.gitlab.jsonnet     # GitLab OAuth mapper
├── app/
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── src/
│   │   ├── index.ts            # Express entry point
│   │   ├── config.ts           # Configuration
│   │   ├── middleware/
│   │   │   ├── auth.ts         # Session validation
│   │   │   └── requireRole.ts  # RBAC middleware
│   │   ├── routes/
│   │   │   ├── me.ts           # /me endpoint
│   │   │   ├── admin.ts        # /admin/* endpoints
│   │   │   └── app.ts          # /app endpoint
│   │   ├── services/
│   │   │   └── kratos.ts       # Kratos SDK wrapper
│   │   └── db/
│   │       ├── client.ts       # PostgreSQL client
│   │       └── migrations/     # SQL migrations
│   └── views/
│       ├── pending.ejs         # Pending approval page
│       ├── dashboard.ejs       # User dashboard
│       └── admin.ejs           # Admin dashboard
└── scripts/
    ├── init-multiple-dbs.sh    # Database initialization
    └── seed-admin.sql          # Admin bootstrap script
```

## Self-Hosted GitLab Configuration

If you're using a self-hosted GitLab instance, update the `issuer_url` in `kratos/kratos.yml`:

```yaml
selfservice:
  methods:
    oidc:
      config:
        providers:
          - id: gitlab
            provider: gitlab
            issuer_url: https://your-gitlab-instance.com  # Change this
            # ... rest of config
```

## License

MIT
