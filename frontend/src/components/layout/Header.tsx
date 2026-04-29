// @ts-nocheck
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { useAuth } from "../../auth/AuthProvider";
import logo from "../../assets/logo.png";

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function Header({ darkMode, onToggleDarkMode }: HeaderProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  return (
    <header className="sticky top-0 z-[9999] w-full bg-[#213F53] dark:bg-slate-950">
      <div className="flex h-16 w-full items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="Trygt Overvann logo" className="h-10 w-auto cursor-pointer object-contain" />
          <div className="text-lg font-semibold text-white">Trygt Overvann AS</div>
        </Link>
        <div className="flex-1" />
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={() => setMenuOpen((v) => !v)}
            className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-white transition hover:opacity-90 ${
              user?.photoURL ? "" : "border-[3px] border-white hover:bg-white/10"
            }`}
            aria-label="Profilmeny"
            aria-expanded={menuOpen}
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profil" className="h-full w-full object-cover" />
            ) : (
              <svg width="35" height="35" viewBox="0 0 24 24" aria-hidden="true">
                <defs>
                  <clipPath id="avatarClip">
                    <circle cx="12" cy="12" r="10.2" />
                  </clipPath>
                </defs>
                <g clipPath="url(#avatarClip)" transform="translate(0,3)">
                  <rect x="0" y="18.5" width="24" height="6" fill="currentColor" />
                  <circle cx="12" cy="8" r="4" fill="currentColor" />
                  <path d="M4.2 19.2c1.4-4.2 5.1-6.5 7.8-6.5s6.4 2.3 7.8 6.5" fill="currentColor" />
                </g>
              </svg>
            )}
          </button>

          {menuOpen && (
            <div
              ref={menuRef}
              className="absolute right-0 mt-3 z-[9999] w-72 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
              {/* Brukerinfo */}
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white text-sm font-semibold text-black dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Profil" className="h-full w-full object-cover" />
                  ) : user?.displayName ? (
                    user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase()
                  ) : (
                    user?.email?.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex flex-col">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {user?.displayName || "Bruker"}
                  </div>
                </div>
              </div>

              {/* Profile */}
              <button
                onClick={() => { setMenuOpen(false); navigate("/profil"); }}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                  <span className="inline-flex h-5 w-5 items-center justify-center">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="currentColor" strokeWidth="2" />
                      <path d="M4 20c2-3.5 5-5 8-5s6 1.5 8 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="text-sm font-medium">Profil</span>
                </div>
                <span className="text-slate-400">›</span>
              </button>

              {/* Files */}
              <button
                onClick={() => { setMenuOpen(false); navigate("/filer"); }}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                  <span className="inline-flex h-5 w-5 items-center justify-center">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                      <path d="M4 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="text-sm font-medium">Filer</span>
                </div>
                <span className="text-slate-400">›</span>
              </button>

              {/* Dark mode */}
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                  <span className="inline-flex h-5 w-5 items-center justify-center">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="text-sm font-medium">Mørk modus</span>
                </div>
                <button
                  onClick={onToggleDarkMode}
                  className={`relative h-6 w-10 rounded-full transition ${darkMode ? "bg-slate-200/30" : "bg-slate-200"}`}
                  aria-label="Bytt mørk modus"
                  type="button"
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${darkMode ? "left-5" : "left-0.5"}`} />
                </button>
              </div>

              {/* Sign out */}
              <button
                onClick={async () => { setMenuOpen(false); await signOut(auth); }}
                className="w-full border-t border-slate-100 px-4 py-3 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </span>
                    <span className="text-sm font-medium">Logg ut</span>
                  </div>
                  <span className="text-slate-400">›</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
