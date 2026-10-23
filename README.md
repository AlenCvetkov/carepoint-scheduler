# Carepoint Scheduler

A small medical scheduling app built for the TeamLift Internship Challenge. A doctor can publish appointment slots with a date, start time, and duration. Visitors can browse slots by speciality, doctor, and date, then reserve one with their name, email, and an optional symptom description. The schedule shows whether a slot is reserved without exposing the patient's personal details.

## Requirements

- Node.js 22.5 or newer (uses Node's built-in SQLite support)
- npm

## Run locally

Install frontend packages once:

```bash
npm install
```

Start the backend API in one terminal:

```bash
npm run server
```

Start the Vite frontend in a second terminal:

```bash
npm run dev
```

Open the local address printed by Vite. In development, Vite forwards `/api` requests to the backend on port 3001.

## Data and API

SQLite stores slots and bookings in `data/carepoint.sqlite`. The database and its tables are created automatically when the API starts. The file stays on this computer across restarts.

- `GET /api/health` — API status
- `GET /api/doctors` — the 17 doctors and their specialities
- `GET /api/slots` — published slots and whether each one is booked
- `POST /api/slots` — publish a doctor's slot
- `POST /api/bookings` — reserve a slot with patient contact details and an optional description

The database enforces one booking per slot. A SQLite trigger also prevents overlapping slots for the same doctor while allowing different doctors to publish at the same time.

## Production build

```bash
npm run build
npm start
```

The backend serves the built frontend and API on the same port. Set the `PORT` environment variable on a hosting service. The hosting service must provide persistent disk storage for the SQLite file if bookings need to survive deployments/restarts.

## What I built

- A responsive schedule and slot-publishing interface
- Dynamic speciality and doctor filters, a calendar date picker, and configurable slot duration
- 17 doctors across the six requested specialities
- A Node.js HTTP API with SQLite persistence
- Validation for dates, durations, patient name and email, overlaps, and double bookings

## AI tools

OpenAI Codex was used as a coding assistant for implementation and review. Before submission, the candidate should review each part of the code and be ready to explain the data model, API routes, and booking constraints.

## What I would improve with more time

- Add host authentication and management controls
- Send a confirmation email after a booking
- Add a hosted PostgreSQL database and automated deployment
- Add automated API and UI tests

