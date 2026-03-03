import { useState } from "react";
import { useAuth } from "./auth/AuthProvider";
import { loginWithEmail, registerWithEmail, logout } from "./auth/authActions";

export default function App() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin() {
    setError("");
    try {
      await loginWithEmail(email, password);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleRegister() {
    setError("");
    try {
      await registerWithEmail(email, password);
    } catch (e) {
      setError(e.message);
    }
  }

  if (loading) return <div>Laster…</div>;

  if (user) {
    return (
      <div style={{ padding: 16 }}>
        <p>Innlogget som: {user.email}</p>
        <button onClick={logout}>Logg ut</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 8, maxWidth: 320 }}>
      <h3>Logg inn</h3>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="E-post"
        autoComplete="email"
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Passord"
        type="password"
        autoComplete="current-password"
      />

      {error && <div style={{ color: "crimson" }}>{error}</div>}

      <button onClick={handleLogin}>Logg inn</button>
      <button onClick={handleRegister}>Registrer</button>
    </div>
  );
}