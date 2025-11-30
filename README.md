# 🚚 CarryConnect-V1 — Community Parcel Carry Platform
Full-Stack Application (React + Node + TypeScript + PostgreSQL + Firebase)

CarryConnect-V1 is a peer-to-peer parcel delivery platform that connects **senders** with **community travellers** who are already moving between cities. Senders create delivery requests → Travellers accept them → Verified delivery via secure OTP process.  
This upgraded V1 focuses on **real-world delivery flow**, **security**, **tracking**, and **minimalistic experience** — without payment gateways or unnecessary complexity.

---

## 📁 Project Structure
```
CarryConnect-V1/
│
├── server/                 # Backend (Node + Express + Drizzle + Firebase)
│   ├── index.ts
│   ├── routes.ts
│   ├── auth.ts
│   ├── notifications.ts
│   ├── storage.ts
│   └── db.ts
│
├── client/                 # Frontend (React + Vite + TS + Tailwind + ShadCN)
│   ├── src/
│   ├── main.tsx
│   └── index.html
│
├── migrations/             # Drizzle SQL migrations
└── shared/                 # Shared schema types
```

---

## ⭐ Key Features
- 🔐 Firebase Authentication (Google + Email)
- 📦 Create & manage delivery requests
- 🤝 Travellers accept deliveries
- 🚦 Status flow: Requested → Accepted → Picked → In-Transit → Delivered
- 🔑 OTP Verification (Pickup & Delivery validation)
- 🧾 Controlled Cancellation System
  - Sender can cancel before pickup
  - Carrier can cancel before transit
- 💬 Real-time in-app chat
- 📱 Push notifications (FCM Token System)
- ⭐ Reviews & Ratings
- 📜 Full Delivery History for both sender & carrier

---

## 🛠 Requirements
- Node.js 20+
- PostgreSQL database
- Firebase project (Firebase Auth + FCM)
- Git

---

## 🚀 Setup & Run

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/carryconnect-v1.git
cd carryconnect-v1
```

### 2️⃣ Install Dependencies
```bash
npm install
```

### 3️⃣ Add Environment Variables
Create `.env` and `server/.env` files manually (not included in repo)
```bash
.env
server/.env
```

### 🔥 Development Mode
```bash
npm run dev
```

### Local URLs
| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:5000/api |

---

## 📦 Production Build
```bash
npm run build
npm start
```

Runs on:
```
http://localhost:5000
```

---

## 📜 NPM Scripts
| Script | Description |
|--------|-------------|
| npm run dev | Start development frontend + backend |
| npm run build | Build frontend & backend |
| npm start | Start production server |
| npm run db:push | Push Drizzle DB schema |

---

## 🌐 Example API Endpoints
| Method | Route | Purpose |
|--------|--------|--------|
| POST | /delivery/create | Create new delivery |
| POST | /delivery/accept | Accept a request |
| POST | /delivery/verify-otp | Validate OTP |
| GET | /deliveries/my | Get all user deliveries |

---

## ❓ Troubleshooting

### ❌ Port 5000 already in use
```bash
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### ❌ Dev script failing on PowerShell
Use CMD:
```bash
npm run dev
```

---

## 🤝 Contributing
Contributions, improvements & feature ideas are welcome.

---

## 👨‍💻 Author
**Dipak Digambar Kalaskar**  
Full-Stack Developer | Building real-world scalable platforms  
⭐ If you like this project, please give a star!

