# Staff Database-Driven Login

## Overview

The ScholarSync Master Platform now features database-driven authentication with bcrypt password hashing. Staff members must have valid credentials stored in the database to log in.

## Database Schema

### Staff Table

```sql
CREATE TABLE staff (
  id TEXT PRIMARY KEY,
  name TEXT,
  role TEXT,
  email TEXT,
  mfa BOOLEAN,
  password TEXT  -- bcrypt hashed password
);
```

## Demo Credentials

The following demo staff accounts are seeded in the database:

| Email | Password | Role | Name |
|-------|----------|------|------|
| sarah@scholarsync.com | Sarah@123 | Master Super Admin | Sarah Johnson |
| ayo@scholarsync.com | Ayo@123 | Onboarding Staff | Ayo Martins |
| chika@scholarsync.com | Chika@123 | Finance/Revenue Staff | Chika Nwosu |
| daniel@scholarsync.com | Daniel@123 | Support Staff | Daniel Peters |
| efe@scholarsync.com | Efe@123 | Customer Care | Efe George |

## Adding New Staff Members

To add new staff members with database credentials, use the staff creation endpoint or directly insert into the database with hashed passwords.

### Using the API

```bash
POST /api/staff
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@scholarsync.com",
  "password": "SecurePassword123",
  "role": "Master Super Admin",
  "mfa": true
}
```

### Manual Password Hashing

To manually generate bcrypt hashes for staff passwords:

```bash
cd apps/api
npx tsx scripts/generate-password-hashes.js
```

This will output SQL UPDATE statements you can execute against your database.

## Authentication Flow

1. **User enters credentials** on the login page (email + password)
2. **Frontend sends** POST request to `/api/auth/login` with email and password
3. **API validates** credentials against the staff table in the database
4. **Password is compared** using bcrypt
5. **JWT token is issued** on successful authentication
6. **User is logged in** with their staff information (id, name, role)

## Login Endpoint

**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "email": "sarah@scholarsync.com",
  "password": "Sarah@123"
}
```

**Success Response (200):**
```json
{
  "ok": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "staff-01",
    "name": "Sarah Johnson",
    "role": "Master Super Admin",
    "email": "sarah@scholarsync.com",
    "mfa": true
  }
}
```

**Error Response (401):**
```json
{
  "ok": false,
  "error": "Invalid email or password"
}
```

## Security Notes

- ✅ Passwords are hashed using bcrypt (10 rounds)
- ✅ JWT tokens expire after 8 hours
- ✅ Database validation is enforced (no fallback demo sessions)
- ✅ Email and password are both required
- ✅ Password is never transmitted in responses

## Setting Up with Your Database

### For D1 (Cloudflare):

1. Update the seed data in `apps/api/d1/init.sql` with your staff credentials (hashed)
2. Run: `npm run d1:init` to initialize the database

### For PostgreSQL:

1. The schema will be created automatically on first connection
2. Insert staff members with hashed passwords using the script above
3. Set `DATABASE_URL` environment variable

## Customizing Password Requirements

To change password hashing rounds or requirements, edit:
- `apps/api/src/index.ts` - `bcrypt.hash()` call in `createStaff()`
- `apps/api/scripts/generate-password-hashes.js` - hash generation parameters
