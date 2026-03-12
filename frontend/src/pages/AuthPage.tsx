// @ts-nocheck

import { useState } from "react";
import {
  loginWithEmail,
  registerWithEmail,
  resetPassword,
  getAuthErrorMessage,
} from "../auth/authActions";
import { updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import "./authPage.css";

type Mode = "login" | "signup";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const isLogin = mode === "login";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!isLogin) {
      if (!firstName.trim() || !lastName.trim()) {
        setError("Fornavn og etternavn må fylles ut");
        return;
      }
      if (password.length < 6) {
        setError("Passord må være minst 6 tegn");
        return;
      }
      if (password !== repeatPassword) {
        setError("Passordene matcher ikke");
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        await loginWithEmail(email, password);
      } else {
        const userCredential = await registerWithEmail(email, password);
        const user = userCredential.user;

        await updateProfile(user, {
          displayName: `${firstName.trim()} ${lastName.trim()}`,
        });

        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: user.email,
          createdAt: serverTimestamp(),
        });
      }
    } catch (e: unknown) {
      setError(getAuthErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setInfo("");

    if (!email.trim()) {
      setError("Skriv inn e-postadressen din først");
      return;
    }

    setResetLoading(true);

    try {
      await resetPassword(email.trim());
      setInfo("Tilbakestillingslenke er sendt til e-postadressen din.");
    } catch (e: unknown) {
      setError(getAuthErrorMessage(e));
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-left">
        <img className="auth-hero" src="/loginbackground.png" alt="Bakgrunn" />
        <div className="auth-logoWrap">
          <img className="auth-logo" src="/LogoTOV.png" alt="Logo" />
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <div className="segmented" role="tablist" aria-label="Auth mode">
            <button
              type="button"
              className={`segmented-btn ${isLogin ? "is-active" : ""}`}
              onClick={() => {
                setMode("login");
                setError("");
                setInfo("");
              }}
              role="tab"
              aria-selected={isLogin}
            >
              Logg inn
            </button>

            <button
              type="button"
              className={`segmented-btn ${!isLogin ? "is-active" : ""}`}
              onClick={() => {
                setMode("signup");
                setError("");
                setInfo("");
              }}
              role="tab"
              aria-selected={!isLogin}
            >
              Opprett
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {!isLogin && (
              <>
                <input
                  className="auth-input"
                  placeholder="Fornavn..."
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
                <input
                  className="auth-input"
                  placeholder="Etternavn..."
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </>
            )}

            <input
              className="auth-input"
              placeholder="E-post..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
            />

            <input
              className="auth-input"
              placeholder="Passord..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
            />

            {isLogin && (
              <div className="auth-helperRow">
                <button
                  type="button"
                  className="auth-linkBtn"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                >
                  {resetLoading ? "Sender..." : "Glemt passord?"}
                </button>
              </div>
            )}

            {!isLogin && (
              <input
                className="auth-input"
                placeholder="Gjenta passord..."
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
              />
            )}

            {error && <div className="auth-error">{error}</div>}
            {info && <div className="auth-info">{info}</div>}

            <button className="auth-submit" disabled={loading}>
              {loading ? "Laster..." : isLogin ? "Logg inn" : "Opprett bruker"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}