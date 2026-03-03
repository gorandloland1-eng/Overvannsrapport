import AuthPage from "./pages/AuthPage";
import { useAuth } from "./auth/AuthProvider";
import { logout } from "./auth/authActions";

function Dashboard() {
  return (
    <div style={{ padding: 16 }}>
      <h2>Inni appen</h2>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div>Laster…</div>;

  // Ikke innlogget → vis login/register-siden
  if (!user) return <AuthPage />;

  // Innlogget → vis resten av appen
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>Innlogget som: {user.email}</div>
        <button onClick={logout}>Logg ut</button>
      </div>

      <Dashboard />
    </div>
  );
}