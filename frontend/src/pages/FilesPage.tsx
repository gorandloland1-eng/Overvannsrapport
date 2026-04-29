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
  calcPdfUrl?: string;
  mapImageUrls?: string[];
  screenshotUrls?: { kart?: string; terreng?: string; satellitt?: string };
  createdAt?: any;
  data?: {
    area?: string | number;
    returnPeriod?: string | number;
    climateFactor?: string | number;
    maxDischarge?: string | number;
    elevation?: number | null;
    length?: number | null;
    concentrationTime?: number | null;
    selectedWeatherStationName?: string;
    infiltration?: string | number;
    address?: string | null;
    gnr?: string | number | null;
    bnr?: string | number | null;
  };
};

const MAP_LAYER_LABELS: Record<string, string> = {
  kart:      "Kart",
  terreng:   "Terreng",
  satellitt: "Satellitt",
};

// ── Icons ─────────────────────────────────────────────────────────────────────

function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" className="shrink-0 text-slate-500 dark:text-slate-400">
      <path d="M4 4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" className="shrink-0 text-slate-500 dark:text-slate-400">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
      <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <path d="M12 3v13M7 11l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FileRow({
  icon,
  label,
  onPreview,
  onDownload,
}: {
  icon: React.ReactNode;
  label: string;
  onPreview: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</span>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={onPreview} className="text-slate-400 transition hover:text-[#213F53] dark:hover:text-white" title="Forhåndsvis">
          <EyeIcon />
        </button>
        <button onClick={onDownload} className="text-slate-400 transition hover:text-[#213F53] dark:hover:text-white" title="Last ned">
          <DownloadIcon />
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FilesPage({
  darkMode,
  setDarkMode,
}: {
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [files, setFiles] = useState<SavedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!menuOpen) return;
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setMenuOpen(false);
      }
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
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as SavedFile[];
      setFiles(data);
      setLoadingFiles(false);
    });
    return () => unsubscribe();
  }, [user]);

  const filteredFiles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return files;
    return files.filter((f) => (f.projectName || "").toLowerCase().includes(term));
  }, [files, searchTerm]);

  async function handleLogout() {
    setMenuOpen(false);
    await signOut(auth);
  }

  function formatDate(createdAt: any) {
    if (!createdAt?.toDate) return "dd/mm/åååå";
    return createdAt.toDate().toLocaleDateString("no-NO");
  }

  async function downloadPdf(url: string, label: string) {
    try {
      const encodedUrl = encodeURIComponent(url);
      const encodedFilename = encodeURIComponent(`${label || "rapport"}.pdf`);
      const response = await fetch(
        `http://localhost:8000/pdf/download-from-url?url=${encodedUrl}&filename=${encodedFilename}`
      );
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${label || "rapport"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      console.error("Kunne ikke laste ned PDF:", e);
      window.open(url, "_blank");
    }
  }

  async function downloadImage(url: string, label: string) {
    try {
      const encodedUrl = encodeURIComponent(url);
      const encodedFilename = encodeURIComponent(`${label}.png`);
      const response = await fetch(
        `http://localhost:8000/pdf/download-from-url?url=${encodedUrl}&filename=${encodedFilename}`
      );
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${label}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      console.error("Kunne ikke laste ned bilde:", e);
      window.open(url, "_blank");
    }
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
      if (file.pdfUrl) { try { await deleteObject(ref(storage, file.pdfUrl)); } catch {} }
      if (file.calcPdfUrl) { try { await deleteObject(ref(storage, file.calcPdfUrl)); } catch {} }
      for (const imgUrl of file.mapImageUrls ?? []) {
        try { await deleteObject(ref(storage, imgUrl)); } catch {}
      }
      await deleteDoc(doc(db, "pdfReports", file.id));
      if (expandedFileId === file.id) setExpandedFileId(null);
    } catch (error) {
      console.error("Kunne ikke slette fil:", error);
      alert("Kunne ikke slette filen.");
    }
  }

  function buildFilesList(file: SavedFile) {
    const pdfItems: { label: string; url: string; type: "pdf" }[] = [
      {
        type: "pdf",
        label: `${file.projectName || "Prosjektnavn"} Rapport`,
        url: file.pdfUrl,
      },
      ...(file.calcPdfUrl
        ? [{ type: "pdf" as const, label: `${file.projectName || "Prosjektnavn"} Utregning PDF`, url: file.calcPdfUrl }]
        : []),
    ];

    let imageItems: { label: string; url: string; type: "image" }[] = [];
    if (file.mapImageUrls?.length) {
      imageItems = file.mapImageUrls.map((url, i) => ({
        type: "image" as const,
        label: `Terreng kart utklipp – ${["Kart", "Terreng", "Satellitt"][i] ?? `Lag ${i + 1}`}`,
        url,
      }));
    } else if (file.screenshotUrls) {
      imageItems = Object.entries(file.screenshotUrls)
        .filter(([, url]) => !!url)
        .map(([key, url]) => ({
          type: "image" as const,
          label: `Terreng kart utklipp – ${MAP_LAYER_LABELS[key] ?? key}`,
          url: url as string,
        }));
    }

    return { pdfItems, imageItems };
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh w-full bg-[#F6F8FF] dark:bg-slate-950">

      {/* ── Header (no search field) ── */}
      <header className="sticky top-0 z-[9999] w-full bg-[#213F53] dark:bg-slate-950">
        <div className="flex h-16 w-full items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Trygt Overvann logo" className="h-10 w-auto cursor-pointer object-contain" />
            <div className="text-lg font-semibold text-white">Trygt Overvann AS</div>
          </Link>

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
                <img src={user.photoURL} alt="Profilbilde" className="h-full w-full object-cover" />
              ) : (
                <svg width="35" height="35" viewBox="0 0 24 24" aria-hidden="true">
                  <defs><clipPath id="avatarClipFiles"><circle cx="12" cy="12" r="10.2" /></clipPath></defs>
                  <g clipPath="url(#avatarClipFiles)" transform="translate(0,3)">
                    <rect x="0" y="18.5" width="24" height="6" fill="currentColor" />
                    <circle cx="12" cy="8" r="4" fill="currentColor" />
                    <path d="M4.2 19.2c1.4-4.2 5.1-6.5 7.8-6.5s6.4 2.3 7.8 6.5" fill="currentColor" />
                  </g>
                </svg>
              )}
            </button>

            {menuOpen && (
              <div ref={menuRef} className="absolute right-0 mt-3 z-[9999] w-72 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white text-sm font-semibold text-black dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="Profilbilde" className="h-full w-full object-cover" />
                    ) : user?.displayName ? (
                      user.displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase()
                    ) : (
                      user?.email?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{user?.displayName || "Bruker"}</div>
                </div>

                <button onClick={() => { setMenuOpen(false); navigate("/profil"); }} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800">
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

                <button onClick={() => { setMenuOpen(false); navigate("/filer"); }} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800">
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
                    onClick={() => setDarkMode(!darkMode)}
                    className={`relative h-6 w-10 rounded-full transition ${darkMode ? "bg-slate-200/30" : "bg-slate-200"}`}
                    aria-label="Toggle mørk modus"
                    type="button"
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${darkMode ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>

                <button onClick={handleLogout} className="w-full border-t border-slate-100 px-4 py-3 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
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

      {/* ── Main ── */}
      <main className="bg-[#F6F8FF] px-8 py-8 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl">

          {/* Title + search row */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Mine filer</h1>
            <div className="relative w-full sm:w-80">
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M16.5 16.5l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-slate-700"
                placeholder="Søk etter filnavn..."
                aria-label="Søk etter filnavn"
              />
            </div>
          </div>

          {loadingFiles ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Laster filer...</div>
          ) : filteredFiles.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              {searchTerm.trim() ? "Ingen filer matcher søket." : "Ingen filer lagret ennå."}
            </div>
          ) : (
            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              {filteredFiles.map((file) => (
                <div key={file.id} className="rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.14)] dark:bg-slate-900">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                      {file.projectName || "Prosjektnavn"}
                    </div>
                    <button onClick={() => handleDeleteFile(file)} className="shrink-0 text-slate-500 transition hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400" title="Slett fil">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                        <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>

                  <div className="mb-6 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="2" />
                      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span>{formatDate(file.createdAt)}</span>
                  </div>

                  <div className="mb-6 text-sm text-slate-700 dark:text-slate-300">
                    {file.description || "PDF-rapport lagret fra prosjektet."}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => toggleExpanded(file.id)} className="rounded-xl bg-[#213F53] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90">
                      Se innhold
                    </button>
                    <button onClick={() => downloadPdf(file.pdfUrl, file.projectName)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                      Last ned PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── File content modal ── */}
      {expandedFileId && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          onClick={() => setExpandedFileId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"
          >
            {(() => {
              const file = files.find((f) => f.id === expandedFileId);
              if (!file) return null;
              const { pdfItems, imageItems } = buildFilesList(file);

              return (
                <>
                  <div className="mb-1 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {file.projectName || "Prosjektnavn"}
                      </h2>
                      <div className="mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                          <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="2" />
                          <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        {formatDate(file.createdAt)}
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedFileId(null)}
                      className="text-xl font-semibold text-slate-400 transition hover:text-red-500 dark:hover:text-red-400"
                      title="Lukk"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
                    {file.description || "PDF-rapport lagret fra prosjektet."}
                  </p>

                  <div className="space-y-2">
                    {pdfItems.map((item, i) => (
                      <FileRow
                        key={i}
                        icon={<PdfIcon />}
                        label={item.label}
                        onPreview={() => window.open(item.url, "_blank")}
                        onDownload={() => downloadPdf(item.url, item.label)}
                      />
                    ))}
                  </div>

                  {imageItems.length > 0 && (
                    <>
                      <div className="my-4 border-t border-slate-200 dark:border-slate-700" />
                      <div className="space-y-2">
                        {imageItems.map((item, i) => (
                          <FileRow
                            key={i}
                            icon={<ImageIcon />}
                            label={item.label}
                            onPreview={() => setPreviewImageUrl(item.url)}
                            onDownload={() => downloadImage(item.url, item.label)}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  <button
                    onClick={async () => {
                      for (const item of pdfItems) await downloadPdf(item.url, item.label);
                      for (const item of imageItems) await downloadImage(item.url, item.label);
                    }}
                    className="mt-4 w-full rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Last ned alle filer
                  </button>

                  <button
                    onClick={() => handleDeleteFile(file)}
                    className="mt-2 w-full rounded-xl border border-red-200 bg-white py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    Slett fil
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Image lightbox ── */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="relative max-h-[90vh] max-w-5xl w-full">
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-10 right-0 text-white text-xl font-semibold transition hover:text-red-400"
            >
              ✕ Lukk
            </button>
            <img
              src={previewImageUrl}
              alt="Kartutklipp forhåndsvisning"
              className="w-full rounded-xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}