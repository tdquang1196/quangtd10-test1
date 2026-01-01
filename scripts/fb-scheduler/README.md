# FB Auto-Comment Scheduler Worker

Background worker for automated Facebook page commenting. Supports two modes:

## 🔀 Modes

### 1. API Mode (Original)
Uses Facebook Graph API. Fast but may trigger spam detection.

### 2. Browser Mode (NEW - Recommended)
Uses Playwright to simulate real browser behavior. Slower but much less likely to be flagged as spam.

---

## 📋 Setup

### 1. Install Dependencies

```bash
cd scripts/fb-scheduler
npm install
```

### 2. Environment Variables

Create `.env` file:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Database Setup

Add new columns to `fb_scheduler_config` table:

```sql
ALTER TABLE fb_scheduler_config
ADD COLUMN IF NOT EXISTS fb_email TEXT,
ADD COLUMN IF NOT EXISTS fb_password TEXT,
ADD COLUMN IF NOT EXISTS fb_cookies TEXT,
ADD COLUMN IF NOT EXISTS use_browser_mode BOOLEAN DEFAULT false;
```

---

## 🚀 Running Locally

### API Mode
```bash
npm run dev
```

### Browser Mode
```bash
npm run dev:browser
```

---

## 🐳 Docker / Railway Deployment

### Set Environment Variable

| Variable | Value | Description |
|----------|-------|-------------|
| `WORKER_MODE` | `api` | Use API mode (default) |
| `WORKER_MODE` | `browser` | Use Browser mode with Playwright |

### Build & Run

```bash
docker build -t fb-worker .
docker run -e WORKER_MODE=browser -e SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... fb-worker
```

---

## 🍪 Cookie-Based Login (Browser Mode)

For browser mode, you can provide Facebook cookies instead of email/password:

1. Login to Facebook in your browser
2. Export cookies using a browser extension (Cookie Editor, EditThisCookie)
3. Save cookies as JSON string in `fb_cookies` column

This avoids 2FA issues and is more reliable.

---

## ⚙️ Configuration

| Field | Description |
|-------|-------------|
| `enabled` | Enable/disable the scheduler |
| `page_id` | Facebook Page ID to post comments on |
| `comments` | Array of comment templates |
| `interval_minutes` | Minutes between runs |
| `delay_between_comments` | Seconds between comments (API mode) |
| `use_browser_mode` | Use Playwright browser automation |
| `fb_email` | Facebook email (browser mode) |
| `fb_password` | Facebook password (browser mode) |
| `fb_cookies` | Facebook session cookies JSON (browser mode) |

---

## 🛡️ Anti-Spam Features (Browser Mode)

- ✅ Random delays between actions (30-90 seconds)
- ✅ Human-like typing speed with variations
- ✅ Realistic browser fingerprinting
- ✅ Automatic scroll simulation
- ✅ Max 5 comments per run (configurable)
- ✅ Session cookie persistence

---

## ⚠️ Disclaimer

This tool is for educational purposes. Automated commenting may violate Facebook's Terms of Service. Use at your own risk.
