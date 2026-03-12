// @ts-nocheck

import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import ProfilePage from "./pages/ProfilePage";
import { useAuth } from "./auth/AuthProvider";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div>Laster…</div>;

  if (!user) return <AuthPage />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/profil" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
