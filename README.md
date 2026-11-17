# UniTrack — Student Attendance Management System

A full-stack university student attendance management system built with Node.js, Express, MongoDB/Mongoose, plain HTML/CSS/JS, audit file logging, a Yargs CLI tool, Jest + Supertest tests, and Docker/Jenkins DevOps configuration.

## Project Structure

```
├── server.js               # Express app, Mongoose connection & API routes
├── seed.js                 # Database seed script (5 students + sample attendance)
├── cli.js                  # Yargs CLI tool (`mark` and `report` commands)
├── models/
│   ├── Student.js          # Student schema (rollNo, name, course, semester, email)
│   └── Attendance.js       # Attendance schema + compound unique index
├── utils/
│   ├── attendanceCalc.js   # Percentage, eligibility (>=75%), subject breakdown
│   ├── logger.js           # fs.appendFile audit logger (logs/attendance.log)
│   └── memoryStore.js      # In-memory fallback when MONGO_URI is unset
├── public/
│   ├── index.html          # Responsive single-page frontend
│   ├── styles.css          # Modern academic UI styling
│   └── app.js              # Role workflows (Admin, Faculty, Student)
├── tests/
│   └── attendance.test.js  # Jest + Supertest unit & API status code tests
├── Dockerfile
├── docker-compose.yml
├── Jenkinsfile
└── .env.example
```

## API Endpoints

- `POST /api/students` — Add a new student (`201`, `400`, `409`)
- `GET /api/students` — List/search students (`?q=...&semester=...`)
- `POST /api/attendance` — Mark attendance (`201`, `400`, `404` unknown rollNo, `409` duplicate for subject+date)
- `GET /api/attendance` — List attendance records (`?subject=...&date=...`)
- `GET /api/attendance/:rollNo` — Returns `{ rollNo, student, total, present, absent, percentage, eligible, records }`
- `GET /api/attendance/:rollNo/subjects` — Subject-wise breakdown via MongoDB aggregation (`$match`, `$group`, `$project`)
- `PUT /api/attendance/:id` — Update attendance status (`200`, `400`, `404`)

## 1. Running Locally

### Prerequisites
- Node.js 20+
- MongoDB running locally (optional — if `MONGO_URI` is omitted, the server starts in seeded in-memory preview mode)

### Steps
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and set MONGO_URI="mongodb://127.0.0.1:27017/attendance"

# 3. Seed sample students and attendance (requires MongoDB running)
npm run seed

# 4. Start the server (listens on PORT || 3000)
npm start
```

Open `http://localhost:3000` in your browser.

### Running Tests
```bash
npm test
```

### Using the CLI Tool
```bash
# Show available commands and options
node cli.js --help

# Mark attendance (appends to logs/attendance.log)
node cli.js mark --roll CS2024001 --subject "Data Structures" --status Present --date 2026-11-17

# View audit log lines for a student
node cli.js report --roll CS2024001
```

## 2. Running with Docker & Docker Compose

```bash
# Build and start the app + MongoDB 7 container
docker compose up -d --build

# Seed the containerized MongoDB instance
docker compose exec app npm run seed
```

The app will be available at `http://localhost:8080`.

To stop containers while preserving the MongoDB volume:
```bash
docker compose down
```

## 3. Deploying to Render with MongoDB Atlas

1. **Create a MongoDB Atlas Cluster**:
   - Sign in to [MongoDB Atlas](https://www.mongodb.com/atlas) and create a free M0 cluster.
   - Create a database user with read/write permissions.
   - Under **Network Access**, allow `0.0.0.0/0` (or Render's outbound IPs).
   - Copy your connection string (`mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/attendance?retryWrites=true&w=majority`).

2. **Deploy Web Service on Render**:
   - Push this repository to GitHub/GitLab.
   - In Render, click **New + -> Web Service** and connect your repository.
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `MONGO_URI`: your MongoDB Atlas connection string
     - `NODE_ENV`: `production`
   - Click **Create Web Service**. Render automatically injects `PORT`.

3. **Seed Production Data (optional)**:
   - Open the Render Shell tab (or run locally with the Atlas `MONGO_URI`) and run:
     ```bash
     npm run seed
     ```
