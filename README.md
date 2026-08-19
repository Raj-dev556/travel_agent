# Frontend — Corporate Travel Management Portal

React + Vite + Tailwind CSS SPA.

## Run

```powershell
npm install
npm run dev          # http://localhost:5173  (proxies /api → backend)
```

## Hotels technical documentation

| Doc | Contents |
|-----|----------|
| [`docs/HOTELS_FRONTEND.md`](docs/HOTELS_FRONTEND.md) | Frontend-only: functions, components, API calls, state per flow |
| [`docs/HOTELS_COMPLETE_FLOW.md`](docs/HOTELS_COMPLETE_FLOW.md) | End-to-end: frontend + backend logic chain |

Backend companion: `corporate-travel-booking-portal-api/docs/HOTELS_BACKEND.md`

Covers: **Autocomplete · Listing · Filter · Listing+Filter · Details · Details+Review**

## UI map

| Route                    | Purpose                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `/login`                 | Tenant-aware sign-in (auto-bootstraps admin in dev)            |
| `/`                      | Redirects to Employee Master                                   |
| `/employee-master`       | Employee data listing, create, edit, Excel upload              |
| `/employee-master/create` | Create employee                                                |
| `/employee-master/:id/edit` | Edit employee                                                |
| `/employee-master/upload` | Employee Excel upload                                          |
| `/grade-policies`        | Grade-wise travel policy listing, create, edit, Excel upload   |
| `/grade-policies/create` | Create grade policy                                            |
| `/grade-policies/:grade/edit` | Edit grade policy                                         |
| `/grade-policies/upload` | Grade policy Excel upload                                      |
| `/budgets`               | Unit and project budget listing, create/edit, Excel upload     |
| `/budgets/projects`      | Project budget listing                                         |
| `/budgets/create`        | Create budget                                                  |
| `/budgets/:id/edit`      | Edit budget                                                    |
| `/budgets/upload`        | Budget Excel upload                                            |
| `/trip-lifecycle`        | Trip request listing, create, change, approval timeline        |
| `/trip-lifecycle/create` | Create trip request                                            |
| `/trip-lifecycle/:id/edit` | Edit or change trip request                                  |
| `/trip-lifecycle/:id/approval` | Trip approval timeline                                  |
| `/booking-calendar`      | Booking calendar filters                                       |
| `/flights`               | **Tripjack-style flight search** (one-way / round / multi)     |
| `/flights/results`       | Real-time flight results with filters & sort                   |
| `/hotels`                | Hotel search                                                   |
| `/hotels/results`        | Hotel results grid                                             |

## Design

Brand colours and the hero gradient are defined in `tailwind.config.js`
and `index.css`. The search panel layout (tabs, trip-type pills, swap
button, traveller popover, cabin selector) mirrors a typical B2B travel
agent console as found at tripjack.com/flight.

## API client

All requests go through `src/api.js`, which:

- Attaches the JWT access token from `useAuthStore`.
- Sends an `X-Tenant` header so the backend can resolve tenant context
  when the dev server is on `localhost` (no real subdomain).
- Logs the user out on `401`.
