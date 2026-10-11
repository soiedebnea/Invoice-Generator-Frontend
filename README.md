# Invoice Generator: Frontend

React (Vite) single-page app for managing clients, services, invoices and payments. It talks to the backend REST API (see `../backend/README.md`).

## Requirements
- Node.js 18+
- The backend running (default `http://localhost:5000`)

## Setup
```bash
cd frontend
npm install
cp .env.example .env     # change VITE_API_URL if your API is elsewhere
npm run dev
```
Open `http://localhost:5173`.

## Environment variables
| Name | Default | Purpose |
|------|---------|---------|
| VITE_API_URL | http://localhost:5000/api | Backend base URL |
| VITE_CURRENCY | USD | ISO currency code for display (e.g. BDT, EUR) |

## Screens
- **Overview**: outstanding, collected and invoiced totals, plus overdue and part-paid invoices
- **Invoices**: create and edit invoices (pick a client, add lines from your services, tax %, discount), open one to see the breakdown, record or remove payments, and print it
- **Clients**: add, edit, delete
- **Services**: add, edit, delete (rates prefill invoice lines)

Invoice status is calculated by the API: unpaid, partial, paid, or overdue (past due date with a balance).

## Build for production
```bash
npm run build     # output in dist/
```

## Structure
```
frontend/
├── index.html
├── vite.config.js
├── package.json
├── .env.example
└── src/
    ├── main.jsx     # entry
    ├── App.jsx      # all screens
    ├── api.js       # fetch wrapper + money/date helpers
    └── styles.css
```
