import { useEffect, useState } from "react";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import ProfilePage from "./pages/ProfilePage";
import FilesPage from "./pages/FilesPage";
import { useAuth } from "./auth/AuthProvider";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

export default function App() {
  const { user, loading } = useAuth();

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("darkMode") === "true";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  if (loading) return <div>Laster…</div>;
  if (!user) return <AuthPage />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage darkMode={darkMode} setDarkMode={setDarkMode} />} />
        <Route path="/profil" element={<ProfilePage darkMode={darkMode} setDarkMode={setDarkMode} />} />
        <Route path="/filer" element={<FilesPage darkMode={darkMode} setDarkMode={setDarkMode} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}