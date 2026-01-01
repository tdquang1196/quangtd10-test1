# 🤖 Browser Worker - Cơ Chế Hoạt Động Chi Tiết

## 📋 Tổng Quan

Browser Worker là một service chạy nền sử dụng **Playwright** để giả lập trình duyệt thật, tự động comment lên các bài post Facebook của page. Khác với API mode, browser mode mô phỏng hành vi người dùng thật để tránh bị Facebook đánh dấu spam.

---

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────────────┐
│                        RAILWAY / LOCAL                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   browser-worker.ts                        │  │
│  │  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐  │  │
│  │  │  Main Loop  │────▶│ checkAndRun │────▶│  runBrowser │  │  │
│  │  │  (1 phút)   │     │             │     │ AutoComment │  │  │
│  │  └─────────────┘     └─────────────┘     └─────────────┘  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    fb-browser.ts                           │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │  │
│  │  │  init()  │  │  login() │  │ getPosts │  │ comment  │   │  │
│  │  │ Browser  │  │ Cookies  │  │  Scrape  │  │  OnPost  │   │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │ fb_scheduler_config │  │   fb_scan_state     │               │
│  │ - enabled           │  │ - comment_tracking  │               │
│  │ - page_id           │  │ - last_processed    │               │
│  │ - fb_cookies        │  │                     │               │
│  │ - comments[]        │  │                     │               │
│  │ - next_run_at       │  └─────────────────────┘               │
│  └─────────────────────┘                                         │
│  ┌─────────────────────┐                                         │
│  │  fb_scheduler_logs  │                                         │
│  │  - type, message    │                                         │
│  └─────────────────────┘                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Quy Trình Hoạt Động Chi Tiết

### Phase 1: Khởi Động (Startup)

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Worker khởi động                                          │
│    └─▶ Load environment variables (.env)                     │
│    └─▶ Kết nối Supabase                                      │
│    └─▶ Chạy checkAndRun() lần đầu                            │
│    └─▶ Đặt interval: mỗi 1 phút gọi checkAndRun()            │
└──────────────────────────────────────────────────────────────┘
```

### Phase 2: Check & Run Loop (Mỗi 1 phút)

```
┌──────────────────────────────────────────────────────────────┐
│ 2. checkAndRun() được gọi                                    │
│    │                                                         │
│    ├─▶ Kiểm tra: Có đang chạy lần trước không?               │
│    │   └─ Nếu CÓ → Skip (tránh chạy song song)               │
│    │                                                         │
│    ├─▶ Lấy config từ Supabase                                │
│    │   └─ Kiểm tra enabled = true?                           │
│    │   └─ Kiểm tra use_browser_mode = true?                  │
│    │                                                         │
│    ├─▶ Kiểm tra thời gian: now >= next_run_at?               │
│    │   └─ Nếu CHƯA → Log "Next run in X minutes" → Exit      │
│    │                                                         │
│    └─▶ Nếu ĐỦ ĐIỀU KIỆN → Chạy runBrowserAutoComment()       │
└──────────────────────────────────────────────────────────────┘
```

### Phase 3: Browser Auto Comment (Core Logic)

```
┌──────────────────────────────────────────────────────────────┐
│ 3. runBrowserAutoComment()                                   │
│                                                              │
│    ╔══════════════════════════════════════════════════════╗  │
│    ║ STEP 1: Initialize Browser                           ║  │
│    ╠══════════════════════════════════════════════════════╣  │
│    ║ • Khởi tạo Chromium (headless mode)                  ║  │
│    ║ • Cài đặt anti-detection:                            ║  │
│    ║   - Disable navigator.webdriver                      ║  │
│    ║   - Fake window.chrome                               ║  │
│    ║   - Vietnamese locale & timezone                     ║  │
│    ║ • Viewport: 1366x768 (realistic)                     ║  │
│    ╚══════════════════════════════════════════════════════╝  │
│                           │                                  │
│                           ▼                                  │
│    ╔══════════════════════════════════════════════════════╗  │
│    ║ STEP 2: Login với Cookies                            ║  │
│    ╠══════════════════════════════════════════════════════╣  │
│    ║ • Parse JSON cookies từ database                     ║  │
│    ║ • Inject cookies vào browser context                 ║  │
│    ║ • Navigate tới facebook.com                          ║  │
│    ║ • Verify login bằng selector:                        ║  │
│    ║   - [aria-label="Menu"]                              ║  │
│    ║   - [aria-label="Trang chủ"]                         ║  │
│    ║   - a[href*="/me"]                                   ║  │
│    ║ • Nếu FAIL → Thử email/password fallback             ║  │
│    ╚══════════════════════════════════════════════════════╝  │
│                           │                                  │
│                           ▼                                  │
│    ╔══════════════════════════════════════════════════════╗  │
│    ║ STEP 3: Lấy danh sách Posts                          ║  │
│    ╠══════════════════════════════════════════════════════╣  │
│    ║ • Navigate tới facebook.com/{page_id}                ║  │
│    ║ • Scroll 3 lần để load thêm posts                    ║  │
│    ║ • Scrape links: /posts/, /videos/, /reel/            ║  │
│    ║ • Giới hạn: 10 posts gần nhất                        ║  │
│    ╚══════════════════════════════════════════════════════╝  │
│                           │                                  │
│                           ▼                                  │
│    ╔══════════════════════════════════════════════════════╗  │
│    ║ STEP 4: Comment lên từng Post                        ║  │
│    ╠══════════════════════════════════════════════════════╣  │
│    ║ FOR each post (max 5 comments/run):                  ║  │
│    ║   │                                                  ║  │
│    ║   ├─▶ Check: Post này đã comment chưa?               ║  │
│    ║   │   └─ So sánh với comment_tracking trong DB       ║  │
│    ║   │                                                  ║  │
│    ║   ├─▶ Chọn random 1 comment chưa post                ║  │
│    ║   │                                                  ║  │
│    ║   ├─▶ Navigate tới post URL                          ║  │
│    ║   │   └─ Human-like scroll                           ║  │
│    ║   │                                                  ║  │
│    ║   ├─▶ Tìm comment box                                ║  │
│    ║   │   └─ Multiple selectors (FB thay đổi thường)     ║  │
│    ║   │                                                  ║  │
│    ║   ├─▶ Type comment (human-like)                      ║  │
│    ║   │   └─ Random delay between chars: 30-110ms        ║  │
│    ║   │   └─ Occasional pause (10% chance)               ║  │
│    ║   │                                                  ║  │
│    ║   ├─▶ Press Enter để submit                          ║  │
│    ║   │                                                  ║  │
│    ║   ├─▶ Update comment_tracking trong DB               ║  │
│    ║   │                                                  ║  │
│    ║   └─▶ Random delay: 30-90 giây trước post tiếp       ║  │
│    ╚══════════════════════════════════════════════════════╝  │
│                           │                                  │
│                           ▼                                  │
│    ╔══════════════════════════════════════════════════════╗  │
│    ║ STEP 5: Cleanup & Schedule Next Run                  ║  │
│    ╠══════════════════════════════════════════════════════╣  │
│    ║ • Export cookies mới (để session không expire)       ║  │
│    ║ • Update fb_cookies trong DB                         ║  │
│    ║ • Update last_run_at = now                           ║  │
│    ║ • Update next_run_at = now + interval_minutes        ║  │
│    ║ • Close browser                                      ║  │
│    ╚══════════════════════════════════════════════════════╝  │
└──────────────────────────────────────────────────────────────┘
```

---

## ⏱️ Timing & Delays

| Hành động | Delay | Lý do |
|-----------|-------|-------|
| Check loop | 1 phút | Kiểm tra xem đến giờ chạy chưa |
| Sau page load | 2-4 giây | Chờ DOM ổn định |
| Mỗi lần scroll | 0.5-1.5 giây | Giả lập đọc content |
| Trước khi type | 0.3-0.6 giây | Giả lập focus |
| Mỗi ký tự type | 30-110ms | Tốc độ gõ người thật |
| Pause ngẫu nhiên | 100-300ms (10%) | Giả lập suy nghĩ |
| Sau submit comment | 2-4 giây | Chờ comment hiển thị |
| Giữa các posts | 30-90 giây | Tránh rate limit |
| Giữa các lần chạy | 15-60 phút (config) | Spam protection |

---

## 🛡️ Anti-Detection Measures

### 1. Browser Fingerprint
```javascript
// Ẩn webdriver flag
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

// Fake Chrome object
window.chrome = { runtime: {} };

// Block notification permission
permissions.query('notifications') → 'denied'
```

### 2. Realistic Behavior
- **Random typing speed**: Mỗi ký tự delay khác nhau
- **Occasional pauses**: 10% chance dừng giữa chừng
- **Human scrolling**: Scroll random 100-400px
- **Random delays**: Không có pattern cố định

### 3. Session Management
- **Cookie-based login**: Không cần nhập password mỗi lần
- **Auto cookie refresh**: Export cookies mới sau mỗi session
- **Persistent session**: Cookies được lưu trong DB

---

## 📊 Database Schema

### fb_scheduler_config
```sql
id                      UUID PRIMARY KEY
enabled                 BOOLEAN         -- Bật/tắt worker
page_id                 TEXT            -- Facebook Page ID
access_token            TEXT            -- API token (cho API mode)
comments                TEXT[]          -- Mảng comments
delay_between_comments  INTEGER         -- Delay giữa comments (giây)
interval_minutes        INTEGER         -- Interval giữa các run (phút)
next_run_at             TIMESTAMP       -- Thời điểm chạy tiếp
last_run_at             TIMESTAMP       -- Lần chạy cuối
fb_email                TEXT            -- Email login (optional)
fb_password             TEXT            -- Password (optional)
fb_cookies              TEXT            -- JSON cookies
use_browser_mode        BOOLEAN         -- true = browser, false = API
```

### fb_scan_state
```sql
id                      UUID PRIMARY KEY
comment_tracking        JSONB           -- { postId: [commented_texts] }
last_processed_post_time TIMESTAMP      -- Post cuối đã xử lý
total_posts_processed   INTEGER         -- Tổng số posts
```

### fb_scheduler_logs
```sql
id                      UUID PRIMARY KEY
type                    TEXT            -- info/success/warning/error
message                 TEXT            -- Log message
created_at              TIMESTAMP       -- Timestamp
```

---

## 🔢 Giới Hạn & Thông Số

| Thông số | Giá trị | Có thể config? |
|----------|---------|----------------|
| Max comments/run | 5 | Hardcoded |
| Max posts to scan | 10 | Hardcoded |
| Check interval | 1 phút | Hardcoded |
| Min delay between posts | 30 giây | Hardcoded |
| Max delay between posts | 90 giây | Hardcoded |
| Page load timeout | 60 giây | Hardcoded |
| Run interval | 15-60 phút | Database config |

---

## 🔄 State Machine

```
┌─────────────┐
│   IDLE      │◀────────────────────────────────────┐
└──────┬──────┘                                     │
       │ 1 phút timer                               │
       ▼                                            │
┌─────────────┐   Not enabled/                      │
│  CHECKING   │───Not time yet──────────────────────┤
└──────┬──────┘                                     │
       │ Ready to run                               │
       ▼                                            │
┌─────────────┐                                     │
│  RUNNING    │                                     │
│  (Browser)  │                                     │
└──────┬──────┘                                     │
       │                                            │
       ▼                                            │
┌─────────────┐                                     │
│ SCHEDULING  │─────Update next_run_at──────────────┘
│ NEXT RUN    │
└─────────────┘
```

---

## ⚠️ Error Handling

### Login Failed
- Screenshot lưu vào `/tmp/error-{timestamp}.png`
- Log error vào database
- Skip run, chờ lần sau

### Post Not Found
- Log warning
- Skip post, tiếp tục post khác

### Comment Box Not Found
- Thử multiple selectors
- Nếu vẫn fail → Log error, skip post

### Network Error
- Retry với timeout 60 giây
- Nếu vẫn fail → Stop run, schedule lại

---

## 📝 Logs Example

```
╔════════════════════════════════════════════════════╗
║   FB Auto-Comment BROWSER Worker Started           ║
║   Using Playwright for human-like behavior         ║
║   Checking every 1 minute...                       ║
╚════════════════════════════════════════════════════╝

[2026-01-01T10:00:00.000Z] [INFO] 🌐 Browser worker started
[2026-01-01T10:00:02.000Z] [INFO] 🌐 Starting BROWSER auto-comment run...
[FB Browser] 📍 Step 1/4: Attempting login...
[FB Browser] 📍 Step 2/4: Parsing cookies...
[FB Browser] ✅ Found 4 cookies: c_user, xs, datr, fr
[FB Browser] 📍 Step 3/4: Adding cookies to browser...
[FB Browser] ✅ Cookies added
[FB Browser] 📍 Step 4/4: Navigating to Facebook...
[FB Browser] ✅ Page loaded, URL: https://www.facebook.com/
[FB Browser] Login confirmed via: [aria-label="Menu"]
[FB Browser] ✅ Cookie login successful
[2026-01-01T10:00:10.000Z] [SUCCESS] ✅ Logged in to Facebook
[FB Browser] 📍 Getting posts from page: mypage123
[FB Browser] 📍 Step 1/3: Navigating to page...
[FB Browser] ✅ Page loaded
[FB Browser] 📍 Step 2/3: Scrolling to load posts...
[FB Browser]    Scroll 1/3...
[FB Browser]    Scroll 2/3...
[FB Browser]    Scroll 3/3...
[FB Browser] 📍 Step 3/3: Extracting post links...
[FB Browser] ✅ Found 8 posts
[2026-01-01T10:00:25.000Z] [INFO] Found 8 posts to check
[2026-01-01T10:00:25.000Z] [INFO] 📄 [1/8] Processing: https://www.facebook.com/mypage123/posts/123...
[2026-01-01T10:00:30.000Z] [INFO] 💬 Posting: "Sản phẩm rất tốt, đã mua..."
[FB Browser] Looking for comment box...
[FB Browser] Typing comment...
[FB Browser] Submitting comment...
[FB Browser] ✅ Comment submitted
[2026-01-01T10:00:45.000Z] [SUCCESS] ✅ Comment posted successfully!
[2026-01-01T10:00:45.000Z] [INFO] ⏳ Waiting 52s before next post...
...
[2026-01-01T10:05:00.000Z] [INFO] 🍪 Cookies updated for next session
[2026-01-01T10:05:01.000Z] [SUCCESS] 🎉 Browser run completed: 5 comments posted on 5 posts
[2026-01-01T10:05:01.000Z] [INFO] 📅 Next run scheduled at: 2026-01-01T10:35:01.000Z
```

---

## 🚀 Deployment

### Local Development
```bash
cd scripts/fb-scheduler
npm install
npm run dev:browser
```

### Railway Production
```bash
# Dockerfile tự động chọn browser mode
ENV WORKER_MODE=browser
```

---

## 📞 Troubleshooting

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|-----------|
| Login failed | Cookies expired | Lấy cookies mới từ browser |
| Timeout | Mạng chậm | Tăng timeout trong code |
| No posts found | Page ID sai | Kiểm tra page_id trong config |
| Comment not posted | Selector thay đổi | Update selectors trong code |
| Rate limited | Comment quá nhiều | Tăng interval_minutes |
