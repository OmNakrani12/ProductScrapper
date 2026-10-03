# WebContact AI 🚀

**WebContact AI** is a production-grade automated contact intelligence SaaS application designed to extract publicly available company contact information (emails, phone numbers, contact/about page URLs, company metadata) from lists of target websites.

![WebContact AI Banner](https://img.shields.value/badge/WebContact_AI-v1.0.0-orange.svg)
![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green.svg)
![Python](https://img.shields.io/badge/Python-3.10-blue.svg)

---

## 🌟 Key Features

- **Multi-Format Upload Support**: Drag & drop support for **CSV**, **XLSX**, and **TXT** files.
- **Smart URL Parsing & Validation**: Automatically detects URL columns in spreadsheets, normalizes domains, removes duplicates, and filters invalid URLs before starting scans.
- **Two-Stage Crawling Strategy**:
  - **Stage 1**: Lightning-fast HTTP fetching using `httpx` + BeautifulSoup4.
  - **Stage 2**: Automatic Playwright headless browser fallback for JavaScript-rendered dynamic web applications.
- **Deep Contact Page Discovery**: Automatically locates and crawls internal contact, contact-us, about, support, and company pages.
- **Contact Extraction & Normalization**:
  - **Emails**: Extracts from visible text, mailto links, and de-obfuscates text (e.g., `info [at] company [dot] com`). Filters static assets and placeholders.
  - **Phones**: Extracts international and regional formats from text and `tel:` links.
  - **Company Names**: Priority resolution using JSON-LD Organization schema, OpenGraph titles, HTML `<title>`, header logo alt tags, or domain fallback.
- **Personal Contact Extraction & Classification**:
  - **Personal Email IDs**: Smartly isolates named individual emails (`john.doe@company.com`, `ceo@company.com`), founder/executive addresses, and personal webmail (`@gmail.com`, `@outlook.com`) from generic corporate aliases (`info@`, `support@`, `sales@`).
  - **Personal Mobile / Direct Numbers**: Isolates personal cell phone numbers and direct lines using international mobile prefix patterns and contextual anchors (`Mobile:`, `Direct:`, `WhatsApp:`), filtering out 1-800 toll-free numbers and reception switchboards.
  - **Social Media Profiles**: Automatically extracts GitHub, LinkedIn, Facebook, Twitter/X, Instagram, YouTube, Discord, Telegram, and other social media profile links from page links, OpenGraph metadata, and JSON-LD schemas.
- **Directory / Showcase Product Link Finder**:
  - Automatically crawls directory/showcase websites (e.g., `scrolllaunch.com`, `producthunt.com`, `betalist.com`, `indiehackers.com`) and extracts external product website URLs listed by users.
  - Automatically decodes redirect parameters, filters out internal directory navigation pages, and provides a 1-click batch import to extract contact info (emails, mobile phones, social media links) for all discovered products.
- **Advanced Search & Filtering**: Search results by personal email, mobile phone, website, company name, or generic business info. Filter by `All`, `Success`, `No Contact`, and `Failed`.
- **Multi-Format Export**: Download complete contact datasets directly as **CSV**, **XLSX** (with autosized columns for Personal Emails, Personal Phones, Business Emails, Business Phones), or structured **JSON**.
- **Enterprise SSRF Protection**: Prevents SSRF security exploits by blocking access to local network interfaces (`127.0.0.1`, `localhost`, `10.x.x.x`, `169.254.x.x`, etc.).

---

## 🏗️ Architecture & Technology Stack

```
                               ┌─────────────────────────┐
                               │     Next.js Frontend    │
                               │  TypeScript / Tailwind  │
                               └────────────┬────────────┘
                                            │ HTTP / JSON API
                                            ▼
                               ┌─────────────────────────┐
                               │      FastAPI Backend    │
                               └────────────┬────────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
          ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
          │   PostgreSQL /   │    │  Redis Task      │    │  Background      │
          │   SQLite DB      │    │  Queue (Celery)  │    │  Async Workers   │
          └──────────────────┘    └──────────────────┘    └─────────┬────────┘
                                                                    │
                                                                    ▼
                                                          ┌──────────────────┐
                                                          │ Crawler Engine   │
                                                          │ HTTPX + BS4      │
                                                          │ Playwright JS    │
                                                          └──────────────────┘
```

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (Dark theme with glowing orange accents)
- **Icons**: Lucide React

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **ORM / DB**: SQLAlchemy 2.0 (PostgreSQL / SQLite dual support)
- **Scraper Engine**: `httpx`, `BeautifulSoup4`, `Playwright`
- **Task Queue**: Background Tasks / Celery + Redis

---

## 📁 Project Structure

```
WebContact-AI/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI Endpoint Routers (jobs, results, export)
│   │   ├── models/          # SQLAlchemy DB Models (Job, WebsiteResult)
│   │   ├── scraper/         # Crawler engine, Email & Phone extractors, Contact page finder
│   │   ├── services/        # Business logic for job management & data export
│   │   ├── utils/           # URL parsing, format validation & SSRF security
│   │   ├── workers/         # Async background task processor & Celery tasks
│   │   ├── config.py        # Settings configuration
│   │   ├── database.py      # DB Session & Engine setup
│   │   └── main.py          # FastAPI application entry point
│   ├── tests/               # Pytest suite (API, extractors, URL parsing, security)
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── app/                 # Next.js App Router (Landing, Dashboard, History)
│   ├── components/          # Reusable UI Components (FileUploader, ResultsTable, Stats)
│   ├── lib/                 # Centralized API client & utility functions
│   ├── types/               # TypeScript interfaces
│   ├── package.json
│   └── tailwind.config.js
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## ⚡ Quick Start (Local Development)

### 1. Prerequisites
- Node.js 18+ and `npm`
- Python 3.10+

### 2. Run Backend
```bash
cd backend

# Create virtual environment (optional)
python -m venv venv
# On Windows: venv\Scripts\activate | On Mac/Linux: source venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Start FastAPI dev server (defaults to SQLite database out of the box)
uvicorn app.main:app --reload --port 8000
```
Backend API interactive documentation is available at: `http://localhost:8000/docs`.

### 3. Run Frontend
```bash
cd frontend

# Install dependencies
npm install

# Start Next.js dev server
npm run dev
```
Open `http://localhost:3000` in your web browser.

---

## 🧪 Running Tests

The backend includes a comprehensive pytest suite testing URL validation, email/phone extraction, SSRF security, and API endpoints:

```bash
cd backend
python -m pytest
```

---

## 🐳 Docker Deployment

Run the complete multi-container stack (Frontend, FastAPI Backend, Celery Worker, PostgreSQL, Redis) with a single command:

```bash
docker compose up --build
```

Access the application at:
- **Frontend App**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`

---

## 📡 API Reference

### Jobs API
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/jobs/upload` | Upload CSV/XLSX/TXT file and create scraping job |
| `POST` | `/api/jobs/direct` | Submit array of URLs directly via JSON body |
| `GET` | `/api/jobs` | Get paginated list of previous scraping jobs |
| `GET` | `/api/jobs/{id}` | Get specific job status and metadata |
| `GET` | `/api/jobs/{id}/progress` | Get realtime progress percentages & counters |
| `GET` | `/api/jobs/{id}/results` | Get paginated website results with search & status filters |
| `DELETE` | `/api/jobs/{id}` | Delete job and associated result records |

### Export API
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/jobs/{id}/export/csv` | Download job results as CSV file |
| `GET` | `/api/jobs/{id}/export/xlsx` | Download job results as formatted Excel XLSX |
| `GET` | `/api/jobs/{id}/export/json` | Download job results as JSON file |

---

## 🔒 Security & SSRF Protection

WebContact AI enforces safety checks on every URL before sending network requests:
- IPv4/IPv6 private range checks (`127.0.0.0/8`, `10.0.0.0/8`, `192.168.0.0/16`, `169.254.0.0/16`).
- Restricted hostname blocking (`localhost`, `metadata.google.internal`).
- Request timeout limits (default: 15s) and maximum concurrent site limits.

run this command in backend folder to run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
