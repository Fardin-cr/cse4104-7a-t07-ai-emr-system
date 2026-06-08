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
- Integrate an AI service that automatically extracts all test parameters from uploaded PDF lab reports without any manual input
- Present extracted data through interactive visual graphs and trend charts on a patient dashboard
- Implement secure role-based authentication for Admin and Doctor user roles
- Deploy the complete system on cloud infrastructure accessible from any device and browser

---

## Proposed Features
- Secure login with two roles — Admin and Doctor
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

## Repository Structure
```
cse4104-7a-t07-ai-emrsystem/
├── ai-emr/            # Main project folder
│   ├── frontend/      # React.js frontend application
│   └── backend/       # FastAPI Python backend
└── README.md
```
