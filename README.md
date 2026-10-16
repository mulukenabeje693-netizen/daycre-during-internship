

# Daycare 🍼

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)

> **Next-Generation Daycare Management System with a stunning Glassmorphic UI.**

Daycare is a comprehensive, secure, and visually striking platform designed to streamline daycare operations, from enrollment and verification to daily management.

## ✨ Features Showcase

### Modern Design & Glassmorphic UI
- **Dynamic Aesthetics:** Beautiful dark/light themes with teal and cyan accents.
- **Custom Curved Cards:** Utilizing `rounded-3xl` for a soft, modern, and approachable feel.
- **Responsive Layouts:** Highly optimized split-screen layouts for seamless desktop and mobile viewing.

### Welcome Page (Landing Page `/`)
- **Hero Section:** Premium "Manage Your Daycare with Absolute Confidence" hero banner featuring the MiNT (Ministry of Innovation and Technology) branding and dual CTA buttons (Get Started, Provider Login).
- **Core Features Showcase:** Clean grid layout highlighting "Easy Child Enrollment," "Live Daily Logs," and "Safe & Confidential" operations.
- **How It Works:** A simple 4-step process guide (Create Center Profile → Onboard Families → Log Daily Activities → Keep Parents Engaged) to quickly educate new users.
- **Trust Indicators:** A fixed stat bar highlighting SSL security, 500+ registered children, and secure activity logs.
<img width="1918" height="912" alt="Screenshot 2026-08-12 062001" src="https://github.com/user-attachments/assets/46ddbb3b-8986-47f6-a656-c6b7e8560bd5" />

### Register Page (`/register`)
- **Dynamic Layout:** Wide two-column split layout with left-aligned branding imagery ("Welcome to Daycare") and an interactive scrolling form on the right.
- **Comprehensive Data Capture:** Collects Full Name, Phone Number, Email (with an inline "Verify Email" button), Organization, Emergency Contact Details, and Relationship.
- **ID Verification Flow:** Dedicated ID Verification module integration prior to account creation ("Secure your account with face and identity verification").
- **Strict Validations & UX:** Regex enforcing Ethiopian phone formats and real-time password strength tracking with a compact visual progress bar ("Excellent / Strong & secure").
- **OAuth Integration:** Seamless "Continue with Google" option as an alternative to standard email registration.
<img width="1917" height="913" alt="Screenshot 2026-08-12 062237" src="https://github.com/user-attachments/assets/2ed5738e-73ee-4ae1-9256-c485e355aa84" />

### Login Page (`/login`)
- **Clean UI Experience:** Focused centered card featuring the MiNT Daycare house badge and welcoming "Welcome Back" typography.
- **Secure Access:** Standard Email and Password login paired with a "Forgot password?" recovery flow.
- **Seamless OAuth:** "Continue with Google" integration for one-click secure access without a password.
- **Account Creation Link:** Easy routing for new users to switch to the "Create an Account" page.
  <img width="1918" height="916" alt="Screenshot 2026-08-12 062110" src="https://github.com/user-attachments/assets/0ebb0bad-bae6-4019-8bcf-735b284cf647" />

### Verification & Access Control
- **ID Verification Module:** Integration ready for face recognition or encrypted credential upload.
- **Role-Based Authorization:** Secure access tiers for admins, staff, and parents.
- **Google OAuth Integration:** Seamless one-click sign-in.

### Comprehensive Multi-Language (i18n) Support
- **Full Localization:** Every single word, label, form field, and button across the entire application (Welcome Page, Login, Register, Dashboards) is fully translated.
- **Supported Languages:** 
  - English (`en`)
  - Amharic (አማርኛ - `am`)
  - Afaan Oromoo (Oromiffa - `om`)
  - Tigrinya (ትግርኛ - `ti`)
- **Seamless Switching:** Users can dynamically toggle their preferred language from the navigation bar, providing an accessible, inclusive experience for all parents and daycare staff.

### 1. Dashboard Module (Role-Based Portals)

The application features tailored dashboard views specific to the user's role to ensure security, relevance, and efficiency, reflecting the exact features implemented in the application:

#### 👑 Admin Dashboard (`AdminDashboard.jsx`)
- **Overview:** Full system oversight and management portal.
- **Key Stats:** Total Children, Active Parents, Childcare Providers, Support Staff, Classrooms, and Monthly Revenue.
- **Portal Navigation:**
  - **Children & Parents:** Manage children profiles, parents & guardians, and process enrollment approvals.
  - **Staff Management:** Add new staff, view staff directory, and manage classroom assignments.
  - **Core Operations:** Track attendance, monitor payments, and handle global communications.
<img width="1918" height="917" alt="Screenshot 2026-08-12 062507" src="https://github.com/user-attachments/assets/92055aad-c23c-46b2-81cb-1fa6c3a394c5" />

#### 🛎️ Reception Dashboard (`ReceptionDashboard.jsx`)
- **Overview:** Front-desk operations focused on check-ins, registration, and immediate scheduling.
- **Key Stats:** Total Families, Present (Checked-in), Upcoming Appointments, and Total Children.
- **Portal Navigation:**
  - **Registration:** Process new registers, update information, and generate Child IDs.
  - **Attendance Tracking:** Manage Nanny attendance and Child attendance logs.
  - **Updates & Comms:** Monitor registration updates and handle front-line communications.
<img width="1918" height="917" alt="Screenshot 2026-08-12 062617" src="https://github.com/user-attachments/assets/8545049a-8f6b-4dd3-83b3-dcb6bc44edf8" />

#### 🍼 Nanny Dashboard (`TeacherDashboard.jsx`)
- **Overview:** Classroom-focused interface for daily child care management and logging.
- **Key Stats:** Total Children in class, Present, Absent, and Currently Napping.
- **Portal Navigation:**
  - **Classroom Management:** View assigned room details, student lists, and monitor capacity.
  - **Daily Reports:** Detailed logging tools for Meals Intake, Activities, Sleep & Naps, and Vaccination Logs.
  - **Operations:** Record classroom attendance and utilize direct communication channels.
<img width="1918" height="921" alt="Screenshot 2026-08-12 062731" src="https://github.com/user-attachments/assets/7f07883c-1adc-47c1-bf5d-030a48070623" />

#### 👨‍👩‍👧 Parent Dashboard (`ParentDashboard.jsx`)
- **Overview:** Personal portal for guardians to track their child's day and manage financial details.
- **Key Stats & Finances:** Overview of My Children, Present Status, Upcoming Appointments, alongside detailed invoice statuses (Paid, Pending, Overdue).
- **Portal Navigation:**
  - **My Children:** Register new children and access comprehensive child profiles.
  - **Tracking & Finance:** Monitor registration updates, process payments, and view Daily Reports.
  - **Communication:** Secure messaging channel to contact the daycare staff.
<img width="1918" height="912" alt="Screenshot 2026-08-12 062810" src="https://github.com/user-attachments/assets/92f734ff-dc63-4dba-b5bb-86825318e147" />

### 2. ID Scan (Verification) Module
- **Automated Check-In/Out:** Secure system utilizing facial recognition and QR/Barcode identity verification.
- **Camera Integration:** WebRTC / React Webcam live video feed overlay for fast scanning.
- **Real-Time Verification:** Automatic cross-referencing with the database (`/api/id/scan`) to match child/guardian profiles.
- **Automated Logging:** Stamps timestamp, guardian name, and photo snapshot on successful verification.
- **Instant Alert System:** Triggers audio and visual feedback (Green for approved, Red alert for unauthorized pickup attempts).
- **Architecture / Workflow:**
  ``
  text
  [Camera Feed] --> [Capture Frame] --> [Decode QR/Face]
         |                                     |
         v                                     v
  (Visual Overlay)                    [API: /api/id/scan]
                                               |
         +-------------------------------------+
         |
         v
  [Database Check] --> (Match?) --Yes--> [Log Check-in] --> [Green Alert]
                           |
                           No---> [Red Alert (Unauthorized)]
  ```

### 3. ID Generate (Card Creator) Module
- **Custom Card Generator:** Create printable/digital ID cards for registered children and authorized guardians.
- **Dynamic Card Template:** Renders child photo, full name, unique ID code, guardian emergency contact, medical alerts, and an encrypted QR code.
- **Customization Controls:** Real-time preview toggle for dark/light theme, layout orientation (Vertical/Horizontal), and branding colors.
- **Export & Print Options:** One-click high-resolution export to PDF (`html2pdf` / `@react-pdf/renderer`) and PNG formats for physical printing or mobile wallet saving.
- **Batch Generation:** Ability for Admins to generate ID cards for an entire classroom or daycare group simultaneously.

## 🔐 Demo Credentials

Use these accounts to explore the system without registering:

| Role | Email | Password |
| :--- | :--- | :--- |
| 👑 **Admin** | habtamugetachew202@gmail.com | `Admin#123` |
| 🍼 **Nanny** | habtamugetachew303@gmail.com | `Nanny#123` |
| 👨‍👩‍👧 **Parent** | habtamugetachew505@gmail.com | `Parent#123` |
| 🛎️ **Receptionist** | habtamugetachew606@gmail.com | `Reception#123` |

> Each role unlocks a different dashboard with role-specific features and permissions.

----

## Profile Settings

### User Profile Menu
The top-right user menu provides quick access to the key personal sections. Clicking the avatar reveals:
- **My Profile** — view and edit personal information and avatar
- **Notifications** — real-time badge showing unread alerts (shown here with 3 unread)
- **Settings** — account preferences and security options
- **Appearance** — toggle between Light and Dark themes instantly
- **Help & Support** — access guides, FAQs, and contact support
- **Sign Out** — securely end the current session

> The badge displays the user's role tag (e.g. `PARENT`, `ADMIN`) for quick identity confirmation at a glance.

<img width="322" height="522" alt="Screenshot 2026-08-12 062940" src="https://github.com/user-attachments/assets/6750478e-3c9b-4ee0-82fb-efc7330f698e" />


> 💡 **To add this screenshot:** Save your image as `profile-menu.png` inside the `screenshots/` folder, then run:
> ```bash
> git add screenshots/profile-menu.png
> git commit -m "Add profile menu screenshot"
> git push
> ```

---

##  Tech Stack & Libraries

| Category | Technologies |
| :--- | :--- |
| **Frontend** | React.js, Tailwind CSS, Lucide Icons |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB |
| **Validation** | Regex (Custom Ethiopian Phone formats), Real-time duplicates check |
| **Styling/UI** | Modern Dark Mode Glassmorphism, CSS Modules/Tailwind |

## 🚀 Getting Started & Environment Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas)

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/habtamugetachew/Daycare.git
   cd Daycare
   ```

2. **Install dependencies:**
   ```bash
   # Install backend dependencies
   npm install

   # Install frontend dependencies
   npm install --prefix frontend
   ```

3. **Environment Setup:**
   Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to
   `frontend/.env`. Configure the database URI, JWT secret, and other backend-only settings
   locally. Never commit `backend/.env` or expose secret values:
   ```env
   PORT=5000
   MONGODB_URI=<existing URI targeting the daycare database>
   JWT_SECRET=<backend-only secret>
   CHAPA_SECRET_KEY=<test secret key from the Chapa merchant dashboard>
   CHAPA_BASE_URL=https://api.chapa.global/v2
   FRONTEND_URL=<public HTTPS frontend origin only>
   CHAPA_RETURN_URL=<optional full /dashboard/parent/payments/success HTTPS URL on that origin>
   CHAPA_CALLBACK_URL=
   ONLINE_PAYMENTS_ENABLED=false
   CHAPA_WEBHOOK_SECRET=
   ```
   For local development, keep both webhook variables empty. Checkout returns to the
   frontend, which asks the authenticated backend to verify the transaction with Chapa;
   the invoice remains pending unless that verification succeeds. If the provider does not
   return a verification reference, the backend will withhold the checkout link until a
   webhook is configured. For a deployed webhook, set `CHAPA_CALLBACK_URL` to
   `https://<backend-host>/api/payments/chapa-webhook` and `CHAPA_WEBHOOK_SECRET` to the
   secret hash configured for that webhook in the Chapa merchant dashboard. Never use a
   placeholder or the Chapa API key as the webhook secret.
   For production, set `NODE_ENV=production`, use a live Chapa key, and set the deployed
   HTTPS frontend URL. The `VITE_API_BASE_URL` frontend build variable must point to the
   backend origin; it contains no Chapa credentials.

4. **Run the Development Server:**
   ```bash
   # Run both frontend and backend concurrently
   npm run dev

   # Or run either side independently
   npm run dev:backend
   npm run dev:frontend
   ```

5. **Build and test:**
   ```bash
   npm run build
   npm test --prefix backend
   npm run build --prefix frontend
   ```

   MongoDB is the existing persistent store. Invoices remain in `Payment`; each Chapa
   checkout attempt is stored in `ChapaPayment`. Back up the existing database and run the
   one-time unique-index migration before deploying:
   `npm run migrate:payment-indexes --prefix backend`. It checks for duplicate non-empty
   references first and aborts without changing data if any are found. Confirm the indexes
   are present before enabling live payments.

### Chapa Hosted Checkout (API v2)

This project uses Chapa's current hosted checkout and verification API:

- Initialize: `POST https://api.chapa.global/v2/payments/hosted`
- Verify: `GET https://api.chapa.global/v2/payments/{chapa_reference}/verify`
- Webhook signature: `x-chapa-signature`, an HMAC-SHA256 of the exact raw request body
  using the webhook secret configured in Chapa.

See the official [API v2 quick start](https://docs.chapa.global/docs/v2/getting-started),
[accept payments](https://docs.chapa.global/docs/v2/integrations/accept-payment),
[verification](https://docs.chapa.global/docs/v2/integrations/verify-payment), and
[webhooks](https://docs.chapa.global/docs/v2/integrations/webhooks) documentation.

Keep `CHAPA_SECRET_KEY` and `CHAPA_WEBHOOK_SECRET` in the backend environment only. Use a
valid test secret key with `NODE_ENV=development` or `test`; use a valid live key only
after the merchant is approved and ready for real transactions. Sample/placeholder keys are
rejected, and test keys are rejected in production. `CHAPA_BASE_URL` must be the official
`https://api.chapa.global/v2` endpoint. `ONLINE_PAYMENTS_ENABLED` is a backend runtime safety
gate and must remain `false` until server-side Chapa configuration has been validated. Once
configured, set it to `true`; an administrator must still enable payments from the dashboard.
The persisted MongoDB `onlinePaymentsEnabled` setting defaults to disabled. Existing legacy
settings do not count as administrator opt-in; the admin must explicitly enable the new setting.
The runtime gate can disable checkout without deleting that setting. Set `FRONTEND_URL` to the
public HTTPS frontend origin only (no path, query, fragment, or credentials). For local Chapa
checkout, deploy the frontend or use a secure HTTPS tunnel that serves it; localhost cannot
receive Chapa's browser return. Set optional `CHAPA_RETURN_URL` to the full HTTPS frontend route
`/dashboard/parent/payments/success` on the same origin, or leave it blank to have the backend
build that route from `FRONTEND_URL`. The backend adds the transaction reference to the return
URL; the frontend then asks the authenticated backend to verify the payment. The local browser
`Origin` is never used as Chapa's return URL.
For production webhooks, set `CHAPA_CALLBACK_URL` to the
public HTTPS backend URL ending in `/api/payments/chapa-webhook`; the backend sends it with
hosted-checkout initialization. Configure the same URL in Chapa's dashboard and put its matching
webhook signing secret in `CHAPA_WEBHOOK_SECRET`. Chapa cannot call a webhook hosted only at `localhost`; during
development, use a secure public tunnel. If `CHAPA_CALLBACK_URL` is unset, browser-return
verification works when hosted-checkout initialization returns a Chapa reference. If it does
not, the backend will not issue a checkout link because it cannot safely verify the transaction;
configure the callback and webhook secret before retrying.

#### Diagnosing callback URL validation failures

The backend trims `CHAPA_CALLBACK_URL`, parses it with Node's `URL`, and requires a public HTTPS
URL with the exact `/api/payments/chapa-webhook` path, no embedded credentials, and no fragment.
The webhook secret must also be non-empty. On startup the backend reports whether the configured
callback passed local validation; this does not test whether Chapa can reach the endpoint. A
`Callback URL must start with https:// and be a valid URL` response is returned from Chapa when
its hosted-checkout initialization rejects the request; it is not the message produced by local
URL validation. Check the sanitized provider response in backend logs and verify the actual callback
value received by the running process.

`dotenv` does not overwrite variables already present in the backend process environment. A
service-level `CHAPA_CALLBACK_URL` therefore takes precedence over `backend/.env`; the backend
warns if those two values differ, without logging either value. Correct the service environment
and restart the backend after changing configuration.

The webhook route accepts `POST`, not `GET`. An HTTP 200 from a tunnel's browser-warning page on
GET does not prove that Chapa's server-to-server POST will reach Express or preserve the webhook
body. Use a public HTTPS tunnel without an interstitial (or a deployed HTTPS backend) and verify
that a signed POST reaches the Express webhook handler. Keep signature verification enabled; never
remove the callback field or treat a redirect, tunnel response, or callback alone as proof of
payment.

Get test/live keys from **Settings → API Keys** in the official Chapa merchant dashboard.
Use test mode and test credentials first; test credentials cannot be used for production.
The settings endpoint can confirm that the key has a recognized format, but only Chapa can
confirm that it is active: an initialization response with HTTP 401/403 means the configured
key was rejected. Copy or regenerate the secret (not the public key) in the same merchant
account and environment, replace `CHAPA_SECRET_KEY` in `backend/.env`, check for a
process-level `CHAPA_SECRET_KEY` override, and restart the backend. Key values are never
logged. A rejected initialization does not record a payment. If Chapa acknowledges an
initialization but omits a valid hosted checkout URL, the attempt is held for server-side
verification and must not be initialized again blindly.
Live readiness cannot be established from source code: merchant approval, valid live
credentials, webhook configuration, HTTPS deployment, and a live dashboard verification must
all be checked by the deploying administrator. This repository does not contain or assert
that merchant credentials are ready for live transactions.

The backend loads the invoice, parent, and child from MongoDB. It calculates the outstanding
balance itself and saves a separate `ChapaPayment` record for each checkout attempt, including
the parent, child, invoice, amount, currency, unique `merchant_reference`, Chapa
`chapa_reference`, status, timestamps, and verified receipt number. The frontend never sends
the charge amount. One active attempt per invoice is enforced by a unique database index;
failed, cancelled, incomplete, or blocked attempts can be retried with a new merchant
reference. Pending or ambiguous attempts are retained and must be checked rather than
silently replaced.

The hosted API request uses the backend bearer key and redirects the parent to the returned
Chapa `checkout_url` only when there is a safe route to a Chapa-issued verification reference.
Provider errors are logged with the endpoint, HTTP status, and a redacted allowlist of response
fields; credentials and request payloads are never logged. A redirect or webhook is only a signal:
successful checkout is
confirmed server-side using the v2 verification endpoint, checking merchant reference,
Chapa reference, exact amount, currency, and success status before marking the invoice paid.
The parent payment list forwards returned transaction references to its result page immediately,
so pending or failed verification cannot leave the parent on the invoice-selection step. A
terminal attempt can be retried from the original invoice; preparing that retry creates a fresh
transaction reference.
V2 webhook signatures are checked against the unmodified raw body with a constant-time
comparison; successful webhook events are re-verified with Chapa. Duplicate events update
the same attempt and cannot create duplicate receipts or settle an invoice twice.

The backend explicitly reads `backend/.env`; environment variables already supplied to the
Node process take precedence over values in that file. After changing credentials, restart the
process that owns the backend port and verify its startup output. A second `npm run dev` or
Nodemon process does not replace a server that is already bound to the port. Startup warns
without printing either value when a process-level `CHAPA_SECRET_KEY` conflicts with the file.

The main payment endpoints are:

- `GET /api/settings` (public, non-sensitive status only): report the effective payment
  status, key/API configuration readiness, and runtime gate state.
- `PUT /api/settings/online-payments` (admin): persist `{ "enabled": true|false }` in
  MongoDB; enabling requires both valid Chapa configuration and
  `ONLINE_PAYMENTS_ENABLED=true`. Disabling is always allowed.
- `POST /api/payments/:id/chapa-prepare` (parent): create or retrieve an owned invoice's
  persisted attempt.
- `POST /api/payments/:id/chapa-init` (parent): initialize that attempt and return its
  hosted checkout URL.
- `POST /api/payments/chapa-verify` and `POST /api/payments/verify` (parent): verify the
  merchant reference returned on the checkout redirect.
- `POST /api/payments/chapa-webhook` (public provider endpoint): validate the v2 signature,
  then re-verify successful events.
- `GET /api/payments/history` (parent/admin/staff/reception): parents only receive their own
  attempts; authorized management roles can view the payment history.
- `GET /api/payments/receipts` and `GET /api/payments/receipts/:id` (authenticated): view
  receipts after successful verification.

Authenticated payment initialization/verification and admin payment-setting changes are
limited to 10 requests per user per minute; signed webhook ingress is limited to 120 per IP
per minute. The default limiter store is process-local. Deployments running multiple backend
instances should configure a shared `express-rate-limit` store so limits are consistent
across instances.

Apply the unique indexes to an existing MongoDB database before enabling checkout:

```powershell
npm run migrate:payment-indexes --prefix backend
```

For safe testing, start with a Chapa test key and an existing unpaid invoice (or use the
project's explicitly enabled, development-only sandbox invoice feature). Test success,
pending, failed, cancelled, network-timeout, duplicate webhook, and invalid-signature cases.
Do not test with real money. Before going live, obtain merchant approval, configure valid
live credentials and the production webhook in Chapa, deploy the HTTPS backend/frontend,
apply the index migration, and verify successful and failed events in the live dashboard.
Live payments are not confirmed as operational until those merchant, credential, webhook,
and deployment checks have actually been completed.

### Parent free trials and monthly billing

The backend supports one 30-day trial per approved parent account with at least one active,
linked child. `FREE_TRIAL_DAYS` can override the 30-day default (integer from 1 to 365).
Set `DAYCARE_MONTHLY_FEE` in `backend/.env` to the daycare's approved monthly fee; the
server uses that amount to create one invoice per linked active child when the trial expires.
There is no fee default: without this setting, an expired trial is reported with a clear
configuration error and no invoice is created. `DAYCARE_PLAN_ID` is optional and defaults
to `daycare-monthly`.

Sandbox checkout invoices are disabled by default. To enable one local test invoice,
set `NODE_ENV=development` (or `test`), `ALLOW_TEST_INVOICES=true`,
`CHAPA_TEST_INVOICE_AMOUNT` to a positive ETB amount, and use a Chapa test secret key.
Configure `CHAPA_WEBHOOK_SECRET` with the signing secret from the dashboard to enable
authenticated webhook processing. Checkout verification also runs server-side against the
v2 API; webhook setup is recommended for reliable status updates.
Chapa shows only the payment methods enabled for the merchant account during hosted
checkout. The application does not promise a specific bank or wallet without confirming
it in the provider checkout.

Manual bank transfers are disabled by default and are not an automatic CBE or bank API
integration. To offer them, configure `BANK_TRANSFER_ENABLED=true`,
`BANK_TRANSFER_BANK_NAME`, `BANK_TRANSFER_ACCOUNT_NAME`, and
`BANK_TRANSFER_ACCOUNT_NUMBER` in the backend environment. `BANK_TRANSFER_INSTRUCTIONS`
is optional. Restart the backend after configuration. Authenticated parents can submit
their bank transaction reference; invoices remain unpaid until an administrator matches
the transaction against actual bank records and approves it in Payment History. Approvals
and rejections record the reviewing administrator, timestamp, reference, and note. No bank
credentials or fictitious account details are supplied by the application.
The test invoice is recorded separately as type `other` with a clear sandbox-only note, a
pending status, a linked parent and child, and an outstanding balance; it does not replace
or modify a monthly invoice. Only one unpaid test invoice is created per parent and linked child;
an existing payable test invoice is returned instead of creating a duplicate. If all prior
test invoices for a child are already paid, the next test invoice can be created for that child
without reusing or changing the paid invoice. If every active child has a test invoice that
is still unpaid or otherwise unsettled, the endpoint refuses to create a duplicate. Never enable test invoices in
production. Trial APIs are
`GET /api/subscriptions/me` and `POST /api/subscriptions/trial`; a trial can be used only
once per parent account. An invoice generated after trial expiry remains unpaid until
Chapa verification succeeds or authorized staff record a payment.

Before adding the billing-period unique index, the existing `daycare` database was checked
for duplicate parent/child/monthly-invoice periods; no duplicates were found. Existing
invoices are not backfilled or modified by this feature.

5. **Opt in to demo data (optional):**
   ```bash
   cd backend
   npm run seed:demo
   ```
   The backend does not seed data during normal startup. The explicit seed command
   requires the `daycare` database, inserts only missing demo records, and does
   not create paid invoices or successful payment transactions.

## 🔌 API Endpoints Documentation

### Meal schedules and intake

`/api/meals` uses the existing `Meal` collection. New schedules must reference an
active classroom and eligible children from that classroom. Nannies (`teacher`
role) can load assigned active classrooms from `GET /api/classrooms?status=active`
and eligible children from `GET /api/meals/students?classroomId={id}`. The
child endpoint returns only active/approved children in that assigned classroom.
Nannies only receive or manage schedules containing children from their assigned
active classrooms. `PUT /api/meals/:id/intake` records each assigned child's
eaten/partially-eaten/not-eaten/refused status, optional quantity percentage,
notes, recorder, and timestamp; only authorized staff can submit it, and meal
intake is accepted after a meal is marked served. The classroom and intake
schema additions are backward-compatible with existing meal documents; no
data migration or seed is required.

Parents use the same authenticated `GET /api/meals` endpoint, which returns only
schedules containing children linked to their account and only those children's
intake entries. An optional `childId` filter is checked against the authenticated
parent's child relationships. Parents can view schedules and intake but cannot
create, edit, delete, or record meals.

### Child registration parent options

The administrator/reception child registration form loads existing parent
accounts from `GET /api/staff/parents/options`. The endpoint requires
authentication, returns only parent-role accounts and the `_id`, name, email,
and phone fields, and never uses frontend demo fallbacks. `POST /api/children`
validates submitted parent IDs against existing parent-role users before
persisting the child relationship.

| Method | Endpoint | Description | Module |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new user/organization | Auth |
| `POST` | `/api/auth/check-email` | Real-time email duplicate check & OTP trigger | Auth |
| `GET` | `/api/auth/check-phone` | Real-time Ethiopian phone number duplicate check | Auth |
| `GET` | `/api/dashboard/stats` | Retrieve real-time analytics and metrics | Dashboard |
| `POST` | `/api/id/scan` | Verify scanned ID / facial recognition data | ID Scan |
| `POST` | `/api/id/generate` | Generate high-res digital ID card batch | ID Generate |

*(More endpoints to be documented as modules are added)*

## 📁 Folder Architecture

```text
daycarehq/
├── backend/
│   ├── controllers/      # Route logic (e.g., authController.js)
│   ├── models/           # Mongoose schemas (e.g., User.js)
│   ├── routes/           # API routes (e.g., authRoutes.js)
│   ├── middleware/       # JWT auth, validation (e.g., authMiddleware.js)
│   ├── utils/            # Helpers (e.g., emailSender.js)
│   └── server.js         # Express entry point
├── frontend/
│   ├── public/           # Static assets
│   ├── src/
│   │   ├── components/   # Reusable UI (Buttons, Inputs, Cards)
│   │   ├── pages/        # Views (Register, Login, Dashboard)
│   │   ├── context/      # React Context for state management
│   │   ├── utils/        # Validation helpers, API calls
│   │   ├── App.jsx       # Main App component with Routing
│   │   └── main.jsx      # React DOM render
│   ├── tailwind.config.js
│   └── package.json
├── .env                  # Environment variables
├── .gitignore
├── package.json          # Root package (concurrently scripts)
└── README.md
```

## 📄 License & Contribution Guidelines

**License:** This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

**Contributing:**
We welcome contributions! 
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
