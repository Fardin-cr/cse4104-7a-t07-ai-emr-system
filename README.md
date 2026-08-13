# AI-Based Medical Report Analysis and Patient Management System

A web-based patient management system for pathology labs that uses AI to automatically extract test values from uploaded PDF lab reports and display them as visual indicators on a patient dashboard. Built to solve the real problem of manual lab report handling in small pathology labs.

---

## Team Information

| Field | Details |
|-------|---------|
| Team Name | CSE4104-7A-T07 |
| Section | 7A |
| Course | CSE 4104 — Software Development III |
| University | Northern University of Business and Technology, Khulna |
| Team Leader | Fardin Galib |

## Team Members

| Name | Student ID | Role |
|------|-----------|------|
| Fardin Galib | 11230121093 | Team Leader · Backend Developer · Deployment |
| Md Ashikur Rahman | 11230121095 | AI Integration Lead · Database Manager |
| Dip Adnan | 11230121067 | Frontend Developer · UI/UX |

---

## Objectives

- Design and develop a web-based patient management system tailored for pathology labs
- Integrate AI to automatically extract test parameters from uploaded PDF lab reports
- Present extracted data through interactive visual indicators on a patient dashboard
- Implement secure role-based authentication for Admin and Doctor user roles
- Deploy the complete system on cloud infrastructure

---

## Features

- Secure login with role-based access — Admin and Doctor
- Patient registration and management with EMR ID generation
- PDF and image lab report upload (JPG, PNG, BMP, TIFF, WebP supported)
- AI-powered automatic extraction of lab values using Anthropic Claude API
- Two-tier AI model strategy: Claude Haiku (fast) → escalates to Claude Sonnet for complex reports
- Value indicators with Normal / High / Low status badges and reference range bars
- Abnormal flag detection — dashboard shows total abnormal values across all patients
- Patient history tracking — grouped by report category (Hematology, Hormone, etc.)
- Trend analysis across serial reports
- Excel export of patient report data
- Cloud file storage via Cloudflare R2 with Supabase Storage fallback

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 |
| Backend | FastAPI (Python 3.12) |
| Database | PostgreSQL via Supabase |
| AI Service | Anthropic Claude API (claude-haiku-4-5 / claude-sonnet-4-5) |
| File Storage | Cloudflare R2 (primary) · Supabase Storage (fallback) |
| Frontend Hosting | Cloudflare Pages |
| Backend Hosting | Railway |

---

## Repository Structure

```
cse4104-7a-t07-ai-emr-system/
├── ai-emr/
│   ├── emr-backend/       # FastAPI Python backend
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── requirements.txt
│   │   ├── .python-version  # Pins Python 3.12 for Railway/Railpack
│   │   ├── routes/
│   │   │   ├── reports.py
│   │   │   └── patients.py
│   │   └── utils/
│   │       ├── extractor.py   # Claude AI extraction pipeline
│   │       └── storage.py     # R2 / Supabase / local storage layer
│   └── frontend/          # React 18 frontend
│       ├── src/
│       └── public/
├── documentation/         # SRS, System Design, API docs
└── README.md
```

---

## Local Setup

### Prerequisites

- Node.js v18+
- Python 3.12
- Git

### Frontend

```bash
cd ai-emr/frontend
npm install
npm run dev
```

### Backend

```bash
cd ai-emr/emr-backend
pip install -r requirements.txt
cp .env.example .env
# Fill in ANTHROPIC_API_KEY, DATABASE_URL, R2 credentials, SUPABASE_URL, SUPABASE_SERVICE_KEY
uvicorn main:app --reload
```

### Required Environment Variables (backend)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `DATABASE_URL` | PostgreSQL connection string (Supabase) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 S3-compatible access key (32 chars) |
| `R2_SECRET_ACCESS_KEY` | R2 secret access key |
| `R2_BUCKET_NAME` | R2 bucket name (default: `emr-reports`) |
| `R2_PUBLIC_URL` | Public R2 dev URL for file access |

---

## Development Roadmap

| Week | Phase | Status |
|------|-------|--------|
| Week 1 | Team Formation & Idea Selection | ✅ Done |
| Week 2 | Project Proposal | ✅ Done |
| Week 3 | SRS Preparation | ✅ Done |
| Week 4 | System Design & Architecture | ✅ Done |
| Week 5 | UI/UX Design & Development Planning | ✅ Done |
| Week 6 | Backend Development | ✅ Done |
| Week 7 | Frontend Development | ✅ Done |
| Week 8 | AI Integration | ✅ Done |
| Week 9 | Feature Completion | ⏳ Upcoming |
| Week 10 | Testing & Debugging | ⏳ Upcoming |
| Week 11 | Deployment | ⏳ Upcoming |
| Week 12 | Documentation | ⏳ Upcoming |
| Week 13 | Presentation Preparation | ⏳ Upcoming |
| Week 14 | Final Presentation & Viva | ⏳ Upcoming |

---

## Task Distribution

| Member | Responsibilities |
|--------|----------------|
| Fardin Galib | Team coordination, FastAPI backend, Railway deployment, R2 storage integration |
| Md Ashikur Rahman | Claude AI integration, PDF/image extraction pipeline, Supabase database management |
| Dip Adnan | React frontend, UI components, Cloudflare Pages deployment, API integration |
```
