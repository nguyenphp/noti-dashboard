# Noti Dashboard

Dashboard theo dõi doanh thu từ MoMo và MB Bank.

## Setup

### 1. Tạo database Supabase

1. Đăng ký tại [supabase.com](https://supabase.com)
2. Tạo project mới
3. Chạy SQL sau trong SQL Editor:

```sql
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  raw_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (optional)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now
CREATE POLICY "Allow all" ON transactions FOR ALL USING (true);
```

### 2. Cấu hình environment

Tạo file `.env.local`:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-key-change-in-production

NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

MOBILE_API_KEY=noti-secret-key-2024
```

### 3. Chạy development server

```bash
npm run dev
```

### 4. Đăng nhập

- Email: `admin@noti.app`
- Password: `admin123`

## Deploy lên Vercel

1. Push code lên GitHub
2. Import project vào Vercel
3. Thêm environment variables trong Vercel dashboard
4. Deploy!

## API Endpoints

### POST /api/transactions

Thêm giao dịch mới (dùng cho mobile app):

```bash
curl -X POST https://your-domain.vercel.app/api/transactions \
  -H "Authorization: Bearer noti-secret-key-2024" \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "source": "momo", "rawText": "..."}'
```
