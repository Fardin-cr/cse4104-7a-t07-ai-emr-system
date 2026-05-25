# AI-Based Medical Report Analysis and Patient Management System

**CSE 4104 — Software Development III | Team CSE4104-7A-T07 | Section 7A**

Northern University of Business and Technology, Khulna
Department of Computer Science and Engineering

---

## Team

| Name | Student ID | Role |
|------|-----------|------|
| Fardin Galib | 11230121093 | Team Leader + Backend Developer |
| Md Ashikur Rahman | 11230121095 | AI Integration Lead + Database Manager |
| Dip Adnan | 11230121067 | Frontend Developer |

---

## Project Overview

A web-based patient management system for pathology labs that uses AI to automatically extract test values from uploaded PDF lab reports and display them as visual graphs on a patient dashboard.

---

## Features

- Secure login with two roles — Admin and Doctor
- Patient registration and management
- PDF lab report upload
- AI-powered automatic extraction of lab values (Claude AI API)
- Data visualization with graphs and charts
- Patient history tracking across multiple visits

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js |
| Backend | FastAPI (Python) |
| Database | PostgreSQL (Supabase) / SQLite (local) |
| AI Service | Claude AI API by Anthropic |
| Frontend Hosting | Cloudflare Pages |
| Backend Hosting | Railway |

---

## Running Locally

### Backend

```bash
cd emr-backend
pip install -r requirements.txt
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
python main.py
```

Backend runs at: http://localhost:8000
API docs at: http://localhost:8000/docs

### Frontend

```bash
cd emr-app
npm install
npm start
```

Frontend runs at: http://localhost:3000

---

## Default Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Doctor | doctor | doc123 |

---

## Project Structure

```
├── emr-backend/
│   ├── main.py              # FastAPI entry point
│   ├── database.py          # Database layer (PostgreSQL/SQLite)
│   ├── requirements.txt
│   ├── .env.example
│   ├── routes/
│   │   ├── auth.py          # Authentication APIs
│   │   ├── patients.py      # Patient management APIs
│   │   └── reports.py       # Report upload and AI extraction APIs
│   └── utils/
│       ├── extractor.py     # Claude AI PDF extraction engine
│       ├── reference_ranges.py  # Clinical reference database
│       └── storage.py       # File storage (local/Supabase)
└── emr-app/
    ├── src/
    │   ├── App.js
    │   ├── pages/           # Dashboard, Patients, LabReports, etc.
    │   ├── components/      # Sidebar, RegisterPatient, UploadReport
    │   ├── context/         # AppContext (global state)
    │   └── utils/           # API calls
    └── public/
```
