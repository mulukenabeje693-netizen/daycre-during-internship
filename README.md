Daycare 🍼
React NodeJS MongoDB TailwindCSS Express.js

Next-Generation Daycare Management System with a stunning Glassmorphic UI.

Daycare is a comprehensive, secure, and visually striking platform designed to streamline daycare operations, from enrollment and verification to daily management.

✨ Features Showcase
Modern Design & Glassmorphic UI
Dynamic Aesthetics: Beautiful dark/light themes with teal and cyan accents.
Custom Curved Cards: Utilizing rounded-3xl for a soft, modern, and approachable feel.
Responsive Layouts: Highly optimized split-screen layouts for seamless desktop and mobile viewing.
Welcome Page (Landing Page /)
Hero Section: Premium "Manage Your Daycare with Absolute Confidence" hero banner featuring the MiNT (Ministry of Innovation and Technology) branding and dual CTA buttons (Get Started, Provider Login).
Core Features Showcase: Clean grid layout highlighting "Easy Child Enrollment," "Live Daily Logs," and "Safe & Confidential" operations.
How It Works: A simple 4-step process guide (Create Center Profile → Onboard Families → Log Daily Activities → Keep Parents Engaged) to quickly educate new users.
Trust Indicators: A fixed stat bar highlighting SSL security, 500+ registered children, and secure activity logs.
Screenshot 2026-08-12 062001
Register Page (/register)
Dynamic Layout: Wide two-column split layout with left-aligned branding imagery ("Welcome to Daycare") and an interactive scrolling form on the right.
Comprehensive Data Capture: Collects Full Name, Phone Number, Email (with an inline "Verify Email" button), Organization, Emergency Contact Details, and Relationship.
ID Verification Flow: Dedicated ID Verification module integration prior to account creation ("Secure your account with face and identity verification").
Strict Validations & UX: Regex enforcing Ethiopian phone formats and real-time password strength tracking with a compact visual progress bar ("Excellent / Strong & secure").
OAuth Integration: Seamless "Continue with Google" option as an alternative to standard email registration.
Screenshot 2026-08-12 062237
Login Page (/login)
Clean UI Experience: Focused centered card featuring the MiNT Daycare house badge and welcoming "Welcome Back" typography.
Secure Access: Standard Email and Password login paired with a "Forgot password?" recovery flow.
Seamless OAuth: "Continue with Google" integration for one-click secure access without a password.
Account Creation Link: Easy routing for new users to switch to the "Create an Account" page. Screenshot 2026-08-12 062110
Verification & Access Control
ID Verification Module: Integration ready for face recognition or encrypted credential upload.
Role-Based Authorization: Secure access tiers for admins, staff, and parents.
Google OAuth Integration: Seamless one-click sign-in.
Comprehensive Multi-Language (i18n) Support
Full Localization: Every single word, label, form field, and button across the entire application (Welcome Page, Login, Register, Dashboards) is fully translated.
Supported Languages:
English (en)
Amharic (አማርኛ - am)
Afaan Oromoo (Oromiffa - om)
Tigrinya (ትግርኛ - ti)
Seamless Switching: Users can dynamically toggle their preferred language from the navigation bar, providing an accessible, inclusive experience for all parents and daycare staff.
1. Dashboard Module (Role-Based Portals)
The application features tailored dashboard views specific to the user's role to ensure security, relevance, and efficiency, reflecting the exact features implemented in the application:

👑 Admin Dashboard (AdminDashboard.jsx)
Overview: Full system oversight and management portal.
Key Stats: Total Children, Active Parents, Childcare Providers, Support Staff, Classrooms, and Monthly Revenue.
Portal Navigation:
Children & Parents: Manage children profiles, parents & guardians, and process enrollment approvals.
Staff Management: Add new staff, view staff directory, and manage classroom assignments.
Core Operations: Track attendance, monitor payments, and handle global communications.
Screenshot 2026-08-12 062507
🛎️ Reception Dashboard (ReceptionDashboard.jsx)
Overview: Front-desk operations focused on check-ins, registration, and immediate scheduling.
Key Stats: Total Families, Present (Checked-in), Upcoming Appointments, and Total Children.
Portal Navigation:
Registration: Process new registers, update information, and generate Child IDs.
Attendance Tracking: Manage Nanny attendance and Child attendance logs.
Updates & Comms: Monitor registration updates and handle front-line communications.
Screenshot 2026-08-12 062617
🍼 Nanny Dashboard (TeacherDashboard.jsx)
Overview: Classroom-focused interface for daily child care management and logging.
Key Stats: Total Children in class, Present, Absent, and Currently Napping.
Portal Navigation:
Classroom Management: View assigned room details, student lists, and monitor capacity.
Daily Reports: Detailed logging tools for Meals Intake, Activities, Sleep & Naps, and Vaccination Logs.
Operations: Record classroom attendance and utilize direct communication channels.
Screenshot 2026-08-12 062731
👨‍👩‍👧 Parent Dashboard (ParentDashboard.jsx)
Overview: Personal portal for guardians to track their child's day and manage financial details.
Key Stats & Finances: Overview of My Children, Present Status, Upcoming Appointments, alongside detailed invoice statuses (Paid, Pending, Overdue).
Portal Navigation:
My Children: Register new children and access comprehensive child profiles.
Tracking & Finance: Monitor registration updates, process payments, and view Daily Reports.
Communication: Secure messaging channel to contact the daycare staff.
Screenshot 2026-08-12 062810
2. ID Scan (Verification) Module
Automated Check-In/Out: Secure system utilizing facial recognition and QR/Barcode identity verification.
Camera Integration: WebRTC / React Webcam live video feed overlay for fast scanning.
Real-Time Verification: Automatic cross-referencing with the database (/api/id/scan) to match child/guardian profiles.
Automated Logging: Stamps timestamp, guardian name, and photo snapshot on successful verification.
Instant Alert System: Triggers audio and visual feedback (Green for approved, Red alert for unauthorized pickup attempts).
Architecture / Workflow: `` text [Camera Feed] --> [Capture Frame] --> [Decode QR/Face] | | v v (Visual Overlay) [API: /api/id/scan] | +-------------------------------------+ | v [Database Check] --> (Match?) --Yes--> [Log Check-in] --> [Green Alert] | No---> [Red Alert (Unauthorized)]

3. ID Generate (Card Creator) Module
Custom Card Generator: Create printable/digital ID cards for registered children and authorized guardians.
Dynamic Card Template: Renders child photo, full name, unique ID code, guardian emergency contact, medical alerts, and an encrypted QR code.
Customization Controls: Real-time preview toggle for dark/light theme, layout orientation (Vertical/Horizontal), and branding colors.
Export & Print Options: One-click high-resolution export to PDF (html2pdf / @react-pdf/renderer) and PNG formats for physical printing or mobile wallet saving.
Batch Generation: Ability for Admins to generate ID cards for an entire classroom or daycare group simultaneously.
🔐 Demo Credentials
Use these accounts to explore the system without registering:

Role	Email	Password
👑 Admin	habtamugetachew202@gmail.com	Admin#123
🍼 Nanny	habtamugetachew303@gmail.com	Nanny#123
👨‍👩‍👧 Parent	habtamugetachew505@gmail.com	Parent#123
🛎️ Receptionist	habtamugetachew606@gmail.com	Reception#123
Each role unlocks a different dashboard with role-specific features and permissions.

Profile Settings
User Profile Menu
The top-right user menu provides quick access to the key personal sections. Clicking the avatar reveals:

My Profile — view and edit personal information and avatar
Notifications — real-time badge showing unread alerts (shown here with 3 unread)
Settings — account preferences and security options
Appearance — toggle between Light and Dark themes instantly
Help & Support — access guides, FAQs, and contact support
Sign Out — securely end the current session
The badge displays the user's role tag (e.g. PARENT, ADMIN) for quick identity confirmation at a glance.

Screenshot 2026-08-12 062940
💡 To add this screenshot: Save your image as profile-menu.png inside the screenshots/ folder, then run:

git add screenshots/profile-menu.png
git commit -m "Add profile menu screenshot"
git push
Tech Stack & Libraries
Category	Technologies
Frontend	React.js, Tailwind CSS, Lucide Icons
Backend	Node.js, Express.js
Database	MongoDB
Validation	Regex (Custom Ethiopian Phone formats), Real-time duplicates check
Styling/UI	Modern Dark Mode Glassmorphism, CSS Modules/Tailwind
🚀 Getting Started & Environment Setup
Prerequisites
Node.js (v16+)
MongoDB (Local or Atlas)
Setup Instructions
Clone the repository:

git clone https://github.com/habtamugetachew/Daycare.git
cd Daycare
Install dependencies:

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
Environment Setup: Create a .env file in the root directory and configure the following variables:

PORT=5000
MONGO_URI=mongodb://localhost:27017/daycarehq
JWT_SECRET=your_super_secret_jwt_key
EMAIL_SERVICE_KEY=your_email_service_api_key
Run the Development Server:

# Run both frontend and backend concurrently
npm run dev
``
🔌 API Endpoints Documentation
Method	Endpoint	Description	Module
POST	/api/auth/register	Register a new user/organization	Auth
POST	/api/auth/check-email	Real-time email duplicate check & OTP trigger	Auth
GET	/api/auth/check-phone	Real-time Ethiopian phone number duplicate check	Auth
GET	/api/dashboard/stats	Retrieve real-time analytics and metrics	Dashboard
POST	/api/id/scan	Verify scanned ID / facial recognition data	ID Scan
POST	/api/id/generate	Generate high-res digital ID card batch	ID Generate
(More endpoints to be documented as modules are added)

📁 Folder Architecture
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
📄 License & Contribution Guidelines
License: This project is licensed under the MIT License. See the LICENSE file for details.

Contributing: We welcome contributions!

Fork the Project
Create your Feature Branch (git checkout -b feature/AmazingFeature)
Commit your Changes (git commit -m 'Add some AmazingFeature')
Push to the Branch (git push origin feature/AmazingFeature)
Open a Pull Request
