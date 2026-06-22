# AI-Based Medical Report Analysis and Patient Management System

## Project Description
A web-based patient management system for pathology labs that uses AI to automatically extract test values from uploaded PDF lab reports and display them as visual graphs on a patient dashboard. Built to solve the real problem of manual lab report handling in small pathology labs.

---

## Team Information
| Field | Details |
|-------|---------|
| Team Name | CSE4104-7A-T07 |
| Section | 7A |
| Course | CSE 4104 - Software Development III |
| University | Northern University of Business and Technology, Khulna |
| Team Leader | Fardin Galib |

## Team Members
| Name | Student ID | Role |
|------|-----------|------|
| Fardin Galib | 11230121093 | Team Leader + Backend Developer |
| Md Ashikur Rahman | 11230121095 | AI Integration Lead + Database Manager |
| Dip Adnan | 11230121067 | Frontend Developer |

---

## Objectives
- Design and develop a web-based patient management system tailored for pathology labs
- Integrate AI to automatically extract test parameters from uploaded PDF lab reports
- Present extracted data through interactive visual graphs on a patient dashboard
- Implement secure role-based authentication for Admin and Doctor user roles
- Deploy the complete system on cloud infrastructure

---

## Proposed Features
- Secure login with role-based access — Admin and Doctor
- Patient registration and management
- PDF lab report upload
- AI-powered automatic extraction of lab values from PDF reports
- Data visualization with graphs and charts on patient dashboard
- Patient history tracking across multiple visits
- Abnormal value detection with Normal, High, Low, and Critical classification

---

## Technology Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React.js |
| Backend | FastAPI (Python) |
| Database | PostgreSQL via Supabase |
| AI Service | Claude AI API by Anthropic |
| Frontend Hosting | Cloudflare Pages |
| Backend Hosting | Railway |

---

## Project Setup Instructions

### Prerequisites
- Node.js v18+
- Python 3.10+
- Git

### Frontend Setup
```bash
cd ai-emr/frontend
npm install
npm run dev
```

### Backend Setup
```bash
cd ai-emr/backend
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload
```


## Repository Structure
```
cse4104-7a-t07-ai-emr-system/
├── ai-emr/
│   ├── frontend/      # React.js frontend application
│   └── backend/       # FastAPI Python backend
├── documentation/     # SRS, System Design, API docs
├── design/            # UI/UX wireframes and screenshots
└── README.md
```

---

## Development Roadmap
| Week | Phase | Status |
|------|-------|--------|
| Week 1 | Team Formation & Idea Selection | ✅ Done |
| Week 2 | Project Proposal | ✅ Done |
| Week 3 | SRS Preparation | ✅ Done |
| Week 4 | System Design & Architecture | ✅ Done |
| Week 5 | UI/UX Design & Development Planning | 🔄 In Progress |
| Week 6 | Backend Development | ✅ Done  |
| Week 7 | Frontend Development | ⏳ Upcoming |
| Week 8 | AI Integration | ⏳ Upcoming |
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
| Fardin Galib | Team coordination, backend API development, deployment |
| Md Ashikur Rahman | AI integration, database management, PDF extraction |
| Dip Adnan | Frontend UI development, React components, API integration |
