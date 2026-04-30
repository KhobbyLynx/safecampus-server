# 🛡️ SafeCampus Backend API

The robust, real-time backbone of the SafeCampus platform, providing secure authentication, incident management, and real-time safety coordination for university communities.

---

## 🚀 Tech Stack

- **Runtime:** Node.js (v18+)
- **Framework:** Express.js with TypeScript
- **Database:** Sequelize ORM (SQLite for local, PostgreSQL for production)
- **Real-time:** Socket.io for instant alerts and coordination
- **Security:** JWT Authentication, Bcrypt password hashing, Helmet, and CORS
- **Validation:** Zod for schema-based request validation
- **Email:** Resend integration for notifications

---

## 📁 Project Structure

```text
backend/
├── src/
│   ├── config/       # Database & Environment configuration
│   ├── controllers/  # Business logic for each resource
│   ├── lib/          # Shared utilities (Socket, Email)
│   ├── middleware/   # Authentication & Error handling
│   ├── models/       # Sequelize data models
│   ├── routes/       # API route definitions
│   └── index.ts      # Application entry point
├── package.json      # Dependencies and scripts
└── tsconfig.json     # TypeScript configuration
```

---

## 🔑 Key Features & API Endpoints

### 🔐 Authentication (`/api/auth`)
| Endpoint    | Method | Description                            |
| :---------- | :----- | :------------------------------------- |
| `/register` | `POST` | Create a new user account              |
| `/login`    | `POST` | Authenticate and receive access token  |
| `/logout`   | `POST` | Invalidate current session             |
| `/me`       | `GET`  | Get current authenticated user profile |

### 🚨 Incident Management (`/api/incidents`)
- **GET** `/`: Fetch all incidents (Admin/Security only)
- **POST** `/`: Report a new emergency incident
- **PATCH** `/:id/status`: Update incident status (Pending → Active → Resolved)

### 🏥 Institution Management (`/api/institutions`)
- **GET** `/`: List all registered universities
- **GET** `/:id`: Get campus boundaries and emergency zones

### 👥 Safety Buddies (`/api/buddies`)
- **POST** `/request`: Send a "buddy request" for a walk or trip
- **GET** `/active`: View active buddy connections

### 📢 Emergency Alerts (`/api/alerts`)
- Real-time broadcast system via Socket.io for campus-wide emergencies.

---

## 🛠️ Setup & Installation

### 1. Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### 2. Environment Configuration
Create a `.env` file in the `backend/` directory:
```env
PORT=5000
JWT_SECRET=your_secret_key_here
DATABASE_URL=sqlite::memory: # Or path to local file
RESEND_API_KEY=your_resend_key
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Initialize Database
```bash
npm run seed
```

### 5. Start the Server
```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

---

## 📡 Real-time Events (Socket.io)

The backend emits and listens for several real-time events:
- `incident:new`: Notifies security personnel of a new report.
- `alert:broadcast`: Sends emergency notices to all connected users.
- `buddy:update`: Real-time location updates between safety buddies.

---

## 🛡️ License
This project is proprietary and confidential. &copy; 2026 Lynxnet Innovations.
