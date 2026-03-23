// @ts-nocheck

import logo from "../assets/logo.png";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { signOut } from "firebase/auth";
import { auth, db, storage } from "../firebase";
import { ref, deleteObject } from "firebase/storage";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";

type SavedFile = {
  id: string;
  userId: string;
  projectName: string;
  description?: string;
  pdfUrl: string;
  createdAt?: any;
  data?: {
    areal?: string | number;
    returperiode?: string | number;
    klimafaktor?: string | number;
    maksPaslipp?: string | number;
    hoyde?: number | null;
    lengde?: number | null;
    konsentrasjonstid?: number | null;
    selectedWeatherStationName?: string;
    infiltrasjon?: string | number;
    adresse?: string | null;
    gnr?: string | number | null;
    bnr?: string | number | null;
  };
};

export default function FilesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const [files, setFiles] = useState<SavedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!menuOpen) return;

      const target = e.target as Node;
      const clickedMenu = menuRef.current?.contains(target);
      const clickedButton = buttonRef.current?.contains(target);

      if (!clickedMenu && !clickedButton) setMenuOpen(false);
    }

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "pdfReports"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      })) as SavedFile[];

      setFiles(data);
      setLoadingFiles(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredFiles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return files;

    return files.filter((file) =>
      (file.projectName || "").toLowerCase().includes(term)
    );
  }, [files, searchTerm]);

  async function handleLogout() {
    setMenuOpen(false);
    await signOut(auth);
  }

  function formatDate(createdAt: any) {
    if (!createdAt?.toDate) return "dd/mm/åååå";
    return createdAt.toDate().toLocaleDateString("no-NO");
  }

  function downloadPdf(url: string, projectName: string) {
    const encodedUrl = encodeURIComponent(url);
    const encodedFilename = encodeURIComponent(
      `${projectName || "rapport"}.pdf`
    );

    window.location.href = `http://localhost:8000/pdf/download-from-url?url=${encodedUrl}&filename=${encodedFilename}`;
  }

  function toggleExpanded(fileId: string) {
    setExpandedFileId((prev) => (prev === fileId ? null : fileId));
  }

  async function handleDeleteFile(file: SavedFile) {
    const confirmed = window.confirm(
      `Er du sikker på at du vil slette "${file.projectName || "denne filen"}"?`
    );

    if (!confirmed) return;

    try {
      if (file.pdfUrl) {
        const pdfRef = ref(storage, file.pdfUrl);
        await deleteObject(pdfRef);
      }

      await deleteDoc(doc(db, "pdfReports", file.id));

      if (expandedFileId === file.id) {
        setExpandedFileId(null);
      }
    } catch (error) {
      console.error("Kunne ikke slette fil:", error);
      alert("Kunne ikke slette filen.");
    }
  }

  return (
    <div className="min-h-dvh w-full bg-[#F6F8FF] dark:bg-slate-950">
      <header className="sticky top-0 z-[9999] w-full bg-[#213F53] dark:bg-slate-950">
        <div className="flex h-16 w-full items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={logo}
              alt="Trygt Overvann logo"
              className="h-10 w-auto cursor-pointer object-contain"
            />
            <div className="text-lg font-semibold text-white">
              Trygt Overvann AS
            </div>
          </Link>

          <div className="flex flex-1 justify-center px-4">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full max-w-xl rounded-xl bg-white px-5 text-center text-sm text-slate-900 shadow-md outline-none placeholder:text-slate-400 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
              placeholder="Søk etter filnavn"
              aria-label="Søk etter filnavn"
            />
          </div>

          <div className="relative">
            <button
              ref={buttonRef}
              onClick={() => setMenuOpen((v) => !v)}
              className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-white transition hover:opacity-90 ${
                user?.photoURL
                  ? ""
                  : "border-[3px] border-white hover:bg-white/10"
              }`}
              aria-label="Profilmeny"
              aria-expanded={menuOpen}
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Profilbilde"
                  className="h-full w-full object-cover"
                />
              ) : (
                <svg width="35" height="35" viewBox="0 0 24 24" aria-hidden="true">
                  <defs>
                    <clipPath id="avatarClipFiles">
                      <circle cx="12" cy="12" r="10.2" />
                    </clipPath>
                  </defs>
                  <g clipPath="url(#avatarClipFiles)" transform="translate(0,3)">
                    <rect x="0" y="18.5" width="24" height="6" fill="currentColor" />
                    <circle cx="12" cy="8" r="4" fill="currentColor" />
                    <path
                      d="M4.2 19.2c1.4-4.2 5.1-6.5 7.8-6.5s6.4 2.3 7.8 6.5"
                      fill="currentColor"
                    />
                  </g>
                </svg>
              )}
            </button>

            {menuOpen && (
              <div
                ref={menuRef}
                className="absolute right-0 mt-3 z-[9999] w-72 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white text-sm font-semibold text-black dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                    {user?.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="Profilbilde"
                        className="h-full w-full object-cover"
                      />
                    ) : user?.displayName ? (
                      user.displayName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
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

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/profil");
                  }}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                        <path
                          d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M4 20c2-3.5 5-5 8-5s6 1.5 8 5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <span className="text-sm font-medium">Profil</span>
                  </div>
                  <span className="text-slate-400">›</span>
                </button>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/filer");
                  }}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                        <path
                          d="M4 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="text-sm font-medium">Filer</span>
                  </div>
                  <span className="text-slate-400">›</span>
                </button>

                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                        <path
                          d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="text-sm font-medium">Mørk modus</span>
                  </div>

                  <button
                    onClick={() => setDarkMode((v) => !v)}
                    className={`relative h-6 w-10 rounded-full transition ${
                      darkMode ? "bg-slate-200/30" : "bg-slate-200"
                    }`}
                    aria-label="Toggle mørk modus"
                    type="button"
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                        darkMode ? "left-5" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full border-t border-slate-100 px-4 py-3 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                      <span className="inline-flex h-5 w-5 items-center justify-center">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                          <path
                            d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M16 17l5-5-5-5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M21 12H9"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
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

      <main className="bg-[#F6F8FF] px-8 py-8 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl">
          <h1 className="mb-8 text-3xl font-bold text-slate-900 dark:text-slate-100">
            Mine filer
          </h1>

          {loadingFiles ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Laster filer...
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              {searchTerm.trim()
                ? "Ingen filer matcher søket."
                : "Ingen filer lagret ennå."}
            </div>
          ) : (
            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              {filteredFiles.map((file) => {
                const isExpanded = expandedFileId === file.id;

                return (
                  <div
                    key={file.id}
                    className="rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.14)] dark:bg-slate-900"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                        {file.projectName || "Prosjektnavn"}
                      </div>

                      <button
                        onClick={() => handleDeleteFile(file)}
                        className="text-slate-500 transition hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                        title="Slett fil"
                      >
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                          <path
                            d="M3 6h18"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M10 11v6M14 11v6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>

                    <div className="mb-6 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                        <rect
                          x="4"
                          y="5"
                          width="16"
                          height="15"
                          rx="2"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M8 3v4M16 3v4M4 10h16"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span>{formatDate(file.createdAt)}</span>
                    </div>

                    <div className="mb-6 text-sm text-slate-700 dark:text-slate-300">
                      {file.description || "PDF-rapport lagret fra prosjektet."}
                    </div>

                    {isExpanded && (
                      <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                        {file.data ? (
                          <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
                            <div>
                              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Eiendom
                              </div>
                              <div>
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  Adresse:
                                </span>{" "}
                                {file.data.adresse || "-"}
                              </div>
                              <div>
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  Gnr/Bnr:
                                </span>{" "}
                                {file.data.gnr ?? "-"} / {file.data.bnr ?? "-"}
                              </div>
                            </div>

                            <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
                              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Terrengdata
                              </div>
                              <div>
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  Høyde:
                                </span>{" "}
                                {file.data.hoyde ?? "-"} m
                              </div>
                              <div>
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  Lengde:
                                </span>{" "}
                                {file.data.lengde ?? "-"} m
                              </div>
                              <div>
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  Konsentrasjonstid:
                                </span>{" "}
                                {file.data.konsentrasjonstid ?? "-"} min
                              </div>
                            </div>

                            <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
                              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Dimensjonering
                              </div>
                              <div>
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  Areal:
                                </span>{" "}
                                {file.data.areal ?? "-"} m²
                              </div>
                              <div>
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  Returperiode:
                                </span>{" "}
                                {file.data.returperiode ?? "-"} år
                              </div>
                              <div>
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  Klimafaktor:
                                </span>{" "}
                                {file.data.klimafaktor ?? "-"}
                              </div>
                              <div>
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  Maks påslipp:
                                </span>{" "}
                                {file.data.maksPaslipp ?? "-"} l/s
                              </div>
                            </div>

                            <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
                              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Infiltrasjon og værstasjon
                              </div>
                              <div>
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  Infiltrasjonskapasitet:
                                </span>{" "}
                                {file.data.infiltrasjon ?? "-"} l/s
                              </div>
                              <div>
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  Værstasjon:
                                </span>{" "}
                                {file.data.selectedWeatherStationName || "-"}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            Det finnes ikke lagrede rapportdata for denne filen ennå.
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => toggleExpanded(file.id)}
                        className="rounded-xl bg-[#213F53] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                      >
                        {isExpanded ? "Skjul innhold" : "Se innhold"}
                      </button>

                      <button
                        onClick={() => downloadPdf(file.pdfUrl, file.projectName)}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Last ned PDF
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}