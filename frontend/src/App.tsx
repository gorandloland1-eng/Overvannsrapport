

import AuthPage from "./pages/AuthPage";
import { useAuth } from "./auth/AuthProvider";
import { logout } from "./auth/authActions";
import HomePage from "./pages/HomePage";
import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import "leaflet/dist/leaflet.css";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div>Laster…</div>;
  if (!user) return <AuthPage />;

  return <HomePage />;
}
