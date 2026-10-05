import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { NotificationProvider } from "@/contexts/NotificationContext";

export const metadata = {
  title: "SPA Client Management System",
  description: "Manage your spa clients with ease",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="light">
      <body className="antialiased">
        <AuthProvider>
          <DataProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
