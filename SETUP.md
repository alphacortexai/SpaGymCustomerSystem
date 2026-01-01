# SPA Client Management System - Setup Guide

## Prerequisites
- Node.js 18+ installed
- Firebase project created

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Enable **Firestore Database** (start in test mode for development)
4. Enable **Authentication**:
   - Go to Authentication > Sign-in method
   - Click on "Google" provider
   - Enable it and save (no additional OAuth setup needed!)
5. Go to Project Settings > General
6. Scroll down to "Your apps" and add a web app
7. Copy the Firebase configuration values

## Step 3: Environment Variables

Create a `.env.local` file in the root directory with the following:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

**That's it!** No Google OAuth credentials or NextAuth secrets needed. Firebase handles Google authentication automatically.

## Step 4: Firestore Security Rules

Update your Firestore security rules to allow authenticated users:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /clients/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Step 5: Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

### ✅ Client Management
- Add clients with name, phone number, and date of birth
- Duplicate phone number detection
- Search clients by name, phone, or date of birth
- View all clients in a table format

### ✅ Birthday Tracking
- Automatically displays clients with birthdays today
- Highlighted section on the dashboard

### ✅ Bulk Import
- Upload Excel files (.xlsx, .xls)
- Automatically detects columns: Name, Phone Number, Date of Birth
- Preview before importing

### ✅ Authentication
- Google OAuth sign-in
- Protected routes (login required)
- Session management

## Excel File Format

Your Excel file should have columns with these names (case-insensitive):
- **Name** (or any column containing "name")
- **Phone Number** (or "phone", "mobile")
- **Date of Birth** (or "dob", "birth", "date")

Example:
| Name | Phone Number | Date of Birth |
|------|--------------|---------------|
| John Doe | 1234567890 | 1990-01-15 |
| Jane Smith | 0987654321 | 1985-05-20 |

## Troubleshooting

### Firebase Connection Issues
- Verify all environment variables are set correctly
- Check Firebase project settings
- Ensure Firestore is enabled

### Authentication Issues
- Verify Firebase Authentication is enabled in Firebase Console
- Check that Google sign-in method is enabled in Firebase Authentication
- Ensure all Firebase environment variables are set correctly

### Excel Upload Issues
- Ensure columns are named correctly
- Date format should be recognizable (YYYY-MM-DD or Excel date format)
- Check browser console for errors

