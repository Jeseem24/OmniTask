# ⚡ OmniTask AI — Autonomous Executive Task Operating System

<div align="center">

![OmniTask AI](https://img.shields.io/badge/OmniTask-AI%20Executive%20Assistant-6366f1?style=for-the-badge&logo=sparkles&logoColor=white)
![Next.js 16](https://img.shields.io/badge/Next.js%2016-Turbopack-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-Modern%20Design-38bdf8?style=for-the-badge&logo=tailwindcss)
![Prisma](https://img.shields.io/badge/Prisma-SQLite%20WAL-2d3748?style=for-the-badge&logo=prisma)
![Groq](https://img.shields.io/badge/Groq%20LPU-Ultra%20Fast%20Inference-f55036?style=for-the-badge)

<p align="center">
  <b>A resilient, zero-latency AI personal task manager that turns chaotic voice notes, PDFs, screenshots, and text messages into structured, prioritized action items.</b>
</p>

[Key Features](#-key-features) • [Architecture](#-architecture) • [Quickstart](#-quickstart) • [Environment Setup](#-environment-setup) • [API Routes](#-api-routes)

</div>

---

## 🌟 Key Features

### 1. 🛡️ Self-Healing Live Model Discovery
* **Zero Deprecation Failures**: Never breaks when LLM providers deprecate or sunset model strings.
* **Auto-Discovery**: Dynamically queries Groq and Gemini provider registries at runtime and selects the best available active reasoning models (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `gemini-3.6-flash`).
* **Multi-Tier Cascade**: Automatically falls back through `Groq LPU` $\rightarrow$ `Google Gemini` $\rightarrow$ `Local Heuristic Engine` with zero user disruption.

### 2. 🎙️ Multi-Modal Intake
* **Audio & Voice Dictation**: Powered by `whisper-large-v3` with formatting synthesis for natural voice capture.
* **Vision & Document OCR**: Upload syllabus PDFs, office memos, schedules, or photos of whiteboards/notes.
* **Smart Client Compression**: Built-in canvas downscaling prevents payload limit issues on mobile networks.
* **Direct Clipboard & File Paste**: Paste screenshots or raw text directly into the AI chat box (`Ctrl+V` / mobile clipboard).

### 3. ⏰ Timezone-Anchored Date Resolution
* Exact client-side timezone forwarding (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
* Resolves ambiguous natural language dates (*"next Friday at 4pm"*, *"day after tomorrow"*, *"in 3 days"*) against a rolling 14-day local calendar reference.

### 4. 🎛️ Dynamic Task Queue & Interactive Card Editing
* **Drag-and-Drop Prioritization**: Reorder tasks on the fly with automatic priority score recalculation.
* **In-Chat Candidate Review**: Modify task titles, notes, calendar dates, and priority tiers directly on candidate cards before committing.
* **Deep Task Inspection**: Modal view for full descriptions, subtask management, and status toggles.
* **Search & Filter Tabs**: Real-time filtering by status (`ALL`, `ACTIVE`, `DONE`) and keyword search.

### 5. ⚡ High-Concurrency Database Architecture
* SQLite configured with **Write-Ahead Logging (WAL)** (`PRAGMA journal_mode = WAL;`) and 5000ms busy timeout for concurrent read/write transactions without lockouts.

---

## 🏛️ Architecture

```mermaid
flowchart TD
    User([User Intake: Voice / PDF / Image / Text / Paste]) --> API[/api/chat & /api/transcribe]
    
    API --> Timezone[Timezone & Date Context Anchor]
    Timezone --> ModelManager[Dynamic Model Discovery & Health Cache]
    
    ModelManager -->|Primary Tier| Groq[Groq LPU: gpt-oss-120b / qwen3.8-27b]
    ModelManager -->|Fallback Tier| Gemini[Google Gemini: gemini-3.6-flash]
    ModelManager -->|Emergency Tier| LocalRegex[Local Heuristic Date Parser]
    
    Groq --> JSONRepair[Partial JSON Repair & Validation]
    Gemini --> JSONRepair
    LocalRegex --> JSONRepair
    
    JSONRepair --> PriorityEngine[Weighted Priority Score Engine]
    PriorityEngine --> DB[(SQLite DB - WAL Mode)]
    
    DB --> UI[Unified Reactive Cockpit UI]
```

---

## 🚀 Quickstart

### Prerequisites
* **Node.js**: v18.18+ or v20+
* **npm** or **pnpm**

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Jeseem24/OmniTask.git
   cd OmniTask
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Add your API keys:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   DATABASE_URL="file:./dev.db"
   ```

4. **Initialize Database**:
   ```bash
   npx prisma migrate dev --name init
   # or
   npx prisma db push
   ```

5. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Environment Setup

| Variable | Description | Required |
| :--- | :--- | :---: |
| `GROQ_API_KEY` | Ultra-fast LPU inference (`openai/gpt-oss-120b`, `whisper-large-v3`) | **Yes** |
| `GEMINI_API_KEY` | Secondary model fallback (`gemini-3.6-flash`) | Optional (Recommended) |
| `DATABASE_URL` | SQLite database URI (`file:./dev.db`) | **Yes** |

---

## 🔌 API Routes

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/api/chat` | `POST` | Multi-modal conversation & task extraction engine |
| `/api/transcribe` | `POST` | Voice note transcription via Whisper LPU |
| `/api/tasks` | `GET`, `POST` | Fetch filtered task lists or manually create a task |
| `/api/tasks/[id]` | `PATCH`, `DELETE` | Update task fields, priority score, or delete task |
| `/api/tasks/confirm` | `POST` | Confirm and commit candidate tasks from chat |
| `/api/share` | `GET` | Retrieve shared documents or URLs |

---

## 🛠️ Tech Stack

* **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
* **Language**: [TypeScript](https://www.typescriptlang.org/)
* **Styling**: [Tailwind CSS](https://tailwindcss.com/)
* **Database ORM**: [Prisma](https://www.prisma.io/) with [SQLite](https://www.sqlite.org/) (WAL mode)
* **AI Providers**: [Groq Cloud](https://console.groq.com/) (LPU Inference) & [Google AI Studio](https://aistudio.google.com/) (Gemini)
* **Icons**: [Lucide React](https://lucide.dev/)

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
