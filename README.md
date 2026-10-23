# SPA Client Management System

A modern, full-featured client management system for spa businesses built with Next.js, Firebase, and Google Authentication.

## Features

- 🔐 **Google Authentication** - Secure login with Google OAuth
- 👥 **Client Management** - Add, search, and manage clients
- 📅 **Birthday Tracking** - Automatically highlights clients with birthdays today
- 📱 **Duplicate Detection** - Warns when adding clients with existing phone numbers
- 📊 **Excel Import** - Bulk import clients from Excel files
- 🔍 **Advanced Search** - Search by name, phone number, or date of birth
- 🔗 **Client data API** - Read-only JSON API so another server can query a client's name, phone number, birthday, and check-ins. See [CLIENT_DATA_API.md](./CLIENT_DATA_API.md).
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile devices

## Tech Stack

- **Framework**: Next.js 16.1.1 (App Router)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Authentication with Google Provider
- **Styling**: Tailwind CSS v4
- **Excel Processing**: xlsx library

## Getting Started

See [SETUP.md](./SETUP.md) for detailed setup instructions.

### Quick Start

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (see SETUP.md)

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/  # NextAuth configuration
│   │   └── clients/              # Client API routes
│   ├── auth/
│   │   └── signin/               # Sign-in page
│   ├── layout.js                 # Root layout
│   └── page.js                   # Main dashboard
├── components/
│   ├── ClientForm.js             # Add client form
│   ├── ClientList.js             # Client list table
│   ├── ExcelUpload.js            # Excel import component
│   ├── ProtectedRoute.js        # Route protection
│   └── SessionProvider.js        # Auth session provider
├── lib/
│   ├── firebase.js               # Firebase configuration
│   ├── clients.js                # Client database operations
│   └── auth.js                   # Auth utilities
└── SETUP.md                      # Detailed setup guide
```

## Usage

### Adding a Client

1. Click on the "Add Client" tab
2. Fill in the form with:
   - Client Name
   - Phone Number (will warn if duplicate exists)
   - Date of Birth
3. Click "Add Client"

### Searching Clients

1. Use the search bar on the dashboard
2. Search by name, phone number, or date of birth
3. Results appear instantly

### Bulk Import

1. Click on the "Upload Excel" tab
2. Prepare an Excel file with columns: Name, Phone Number, Date of Birth
3. Upload the file
4. Preview and confirm import

## Environment Variables

Required environment variables (see SETUP.md for details):

- Firebase configuration (6 variables)
- NextAuth configuration (2 variables)
- Google OAuth (2 variables)

## License

Private project
