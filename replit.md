# BetUZ - O'zbek Kazino va Sport Tikish Sayti

## Overview

O'zbek tilida to'liq kazino va sport tikish platformasi.

## Stack

- **Frontend**: React + Vite + Tailwind CSS + Framer Motion
- **Backend**: Express 5 + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT (30 kunlik sessiya, localStorage)
- **Monorepo**: pnpm workspaces

## Structure

```
artifacts/
  betuz/          # React frontend (port 25827, path: /)
  api-server/     # Express backend (port 8080, path: /api)
lib/
  db/             # Drizzle schema + DB connection
  api-spec/       # OpenAPI spec
  api-client-react/ # Generated React Query hooks
  api-zod/        # Generated Zod schemas
```

## DB Tables

- `users` — isAdmin, lastIp, fingerprint, blockReason fields added
- `tg_msg_map` — Telegram chatId + msgId → userId mapping (DB-based, survives restarts)
- `tg_msg_map` replaces the old RAM-based `Map<string, string>` in support.ts

## Features

- **Auth**: Ro'yxatdan o'tish/Kirish, JWT sessiya 30 kun
- **Admin Panel**: Kod: M1i2r3z4o5, foydalanuvchilarni boshqarish
- **Kazino**: 20+ o'yin (Slots 50/50, Mines, Crash, Dice, va boshqalar)
- **Sport**: Futbol tikish, real vaqtda koeffitsientlar
- **Depozit**: Uzcard/Humo/Visa, Telegram bot orqali tasdiqlash
- **Chiqim**: Min talablar, profil to'liqligi, wager nisbati
- **Support**: Telegram bot bilan chat
- **Referral**: 5 do'st + 100k depozit = 200k bonus

## Admin Panel

- Kirish: Saytning pastki navida "Admin" tugmasi
- Kod: **M1i2r3z4o5**
- Imkoniyatlar: Foydalanuvchi ro'yxati, balans qo'shish/ayirish, bloklash

## Telegram Bot

- Token: 8520676994:AAGeJoFl7snXkTfNG3iRFSxX4J8fB6JXReA
- Chat ID: 8414989794

## Card Numbers (Deposit)

- 8600 0609 9769 8544 - Umurova Sayyora
- 5614 6867 0950 1780 - Negmurodov Mirzoxid
- 9860 1966 1932 3336 - Negmurodov Mirzoxid
- 4195 2500 5245 9060 - Negmurodov Mirzoxid

## Deposit Limits

- Uzcard: min 30,000
- Humo: min 10,000
- Visa: min 100,000

## Withdrawal Limits

- Uzcard: max 80,000
- Humo: max 70,000
- Visa: max 100,000

## Slots Win Rate

- **50/50** - Frontend va backend ikkalasi ham `Math.random() < 0.5` ishlatadi
- Yutganda 2x multiplikator
- Frontend reellarni backendga yuboradi, backend ularni tekshiradi
