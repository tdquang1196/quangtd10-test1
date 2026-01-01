# Hướng dẫn lấy Facebook Cookies cho Browser Mode

## Tại sao cần cookies?

Browser Mode cần Facebook cookies để đăng nhập mà không cần nhập email/password mỗi lần. Điều này giúp:
- ✅ Bypass 2FA (xác thực 2 bước)
- ✅ Tránh bị Facebook yêu cầu xác minh
- ✅ Session ổn định hơn

---

## Cách 1: Sử dụng Extension trình duyệt

### Bước 1: Cài đặt Extension
- **Chrome**: [Cookie Editor](https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm)
- **Firefox**: [Cookie-Editor](https://addons.mozilla.org/en-US/firefox/addon/cookie-editor/)

### Bước 2: Đăng nhập Facebook
1. Mở [facebook.com](https://www.facebook.com)
2. Đăng nhập bằng tài khoản bạn muốn dùng để auto-comment
3. Đảm bảo bạn đã đăng nhập thành công

### Bước 3: Export Cookies
1. Click vào icon Extension (Cookie Editor)
2. Click **"Export"** → **"Export as JSON"**
3. Copy toàn bộ JSON

### Bước 4: Lưu vào Database
Paste JSON vào cột `fb_cookies` trong bảng `fb_scheduler_config`

---

## Cách 2: Sử dụng DevTools (không cần Extension)

### Bước 1: Mở DevTools
1. Đăng nhập Facebook
2. Nhấn `F12` hoặc `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)

### Bước 2: Lấy Cookies
1. Chuyển sang tab **Application** (Chrome) hoặc **Storage** (Firefox)
2. Expand **Cookies** → chọn `https://www.facebook.com`
3. Bạn sẽ thấy danh sách cookies

### Bước 3: Copy cookies quan trọng
Các cookies quan trọng cần lấy:
- `c_user` - User ID
- `xs` - Session token (quan trọng nhất!)
- `datr` - Browser identifier
- `fr` - Facebook tracking

### Bước 4: Format thành JSON
```json
[
  {
    "name": "c_user",
    "value": "YOUR_C_USER_VALUE",
    "domain": ".facebook.com",
    "path": "/"
  },
  {
    "name": "xs",
    "value": "YOUR_XS_VALUE",
    "domain": ".facebook.com",
    "path": "/"
  },
  {
    "name": "datr",
    "value": "YOUR_DATR_VALUE",
    "domain": ".facebook.com",
    "path": "/"
  },
  {
    "name": "fr",
    "value": "YOUR_FR_VALUE",
    "domain": ".facebook.com",
    "path": "/"
  }
]
```

---

## Cách 3: Sử dụng Console Script

Copy và paste đoạn code sau vào Console của DevTools khi đang ở facebook.com:

```javascript
// Copy this to clipboard
const cookies = document.cookie.split(';').map(c => {
  const [name, ...value] = c.trim().split('=');
  return {
    name,
    value: value.join('='),
    domain: '.facebook.com',
    path: '/'
  };
});
copy(JSON.stringify(cookies, null, 2));
console.log('Cookies copied to clipboard!');
```

---

## Lưu ý quan trọng

### ⚠️ Bảo mật
- **KHÔNG chia sẻ cookies** với bất kỳ ai
- Cookies cho phép ai đó đăng nhập vào tài khoản của bạn
- Lưu trữ an toàn trong database

### ⏰ Hết hạn
- Cookies Facebook thường có hiệu lực 90 ngày
- Nếu không hoạt động trong 2 tuần, có thể bị hết hạn
- Worker sẽ tự động cập nhật cookies sau mỗi lần chạy

### 🔄 Làm mới Cookies
Nếu gặp lỗi đăng nhập:
1. Đăng nhập lại Facebook trên trình duyệt
2. Export cookies mới
3. Cập nhật trong database

---

## Kiểm tra Cookies

Để kiểm tra cookies còn hoạt động, chạy:

```bash
cd scripts/fb-scheduler
npm run dev:browser
```

Nếu log hiển thị "✅ Cookie login successful" thì cookies còn hoạt động.

---

## Troubleshooting

| Lỗi | Nguyên nhân | Giải pháp |
|-----|-------------|-----------|
| Cookie login failed | Cookies hết hạn | Export cookies mới |
| 2FA detected | Facebook yêu cầu xác minh | Đăng nhập thủ công, vượt qua 2FA, rồi export cookies |
| Security checkpoint | Facebook nghi ngờ hoạt động bất thường | Chờ vài ngày, xác minh danh tính trên Facebook |
