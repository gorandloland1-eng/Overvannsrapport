import logo from "../assets/logo.png";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  signOut,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { auth, db, storage } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Link, useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");

  const [projectName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const [firstName, setFirstName] = useState(
    user?.displayName?.split(" ")[0] || ""
  );
  const [lastName, setLastName] = useState(
    user?.displayName?.split(" ").slice(1).join(" ") || ""
  );
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>(
    user?.photoURL || ""
  );

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

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
    return () => {
      if (photoPreview && photoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  async function handleLogout() {
    setMenuOpen(false);
    await signOut(auth);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (photoPreview && photoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!user) return;

    setSaving(true);
    setSaveMessage("");
    setSaveError("");

    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

      let photoURL = user.photoURL || "";

      if (photoFile) {
        const fileRef = ref(
          storage,
          `profilePictures/${user.uid}/${Date.now()}-${photoFile.name}`
        );
        await uploadBytes(fileRef, photoFile);
        photoURL = await getDownloadURL(fileRef);
      }

      await updateProfile(user, {
        displayName: fullName,
        photoURL,
      });

      await user.reload();

      await updateDoc(doc(db, "users", user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        photoURL,
      });

      setSaveMessage("Profilen ble lagret.");
      setPhotoFile(null);
      setPhotoPreview(photoURL || "");
    } catch (e: unknown) {
      setSaveError(
        e instanceof Error ? e.message : "Kunne ikke lagre profilen."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSecuritySave() {
    if (!user || !user.email) return;

    setSaving(true);
    setSaveMessage("");
    setSaveError("");

    try {
      if (!currentPassword || !newPassword || !repeatPassword) {
        throw new Error("Alle passordfeltene må fylles ut.");
      }

      if (newPassword !== repeatPassword) {
        throw new Error("Nytt passord og gjenta passord må være like.");
      }

      if (newPassword.length < 6) {
        throw new Error("Nytt passord må være minst 6 tegn.");
      }

      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );

      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setSaveMessage("Passordet ble oppdatert.");
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
    } catch (e: unknown) {
      setSaveError(
        e instanceof Error ? e.message : "Kunne ikke oppdatere passordet."
      );
    } finally {
      setSaving(false);
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
              value={projectName}
              readOnly
              className="h-10 w-full max-w-xl rounded-full bg-white px-5 text-center text-sm text-slate-900 shadow-md outline-none dark:bg-slate-900 dark:text-slate-100"
              placeholder=""
              aria-label="Prosjektnavn"
            />
          </div>

          <div className="relative">
            <button
              ref={buttonRef}
              onClick={() => setMenuOpen((v) => !v)}
              className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-white transition hover:opacity-90 ${
                photoPreview || user?.photoURL
                  ? ""
                  : "border-[3px] border-white hover:bg-white/10"
              }`}
              aria-label="Profilmeny"
              aria-expanded={menuOpen}
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Profilbilde"
                  className="h-full w-full object-cover"
                />
              ) : user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Profilbilde"
                  className="h-full w-full object-cover"
                />
              ) : (
                <svg
                  width="35"
                  height="35"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <defs>
                    <clipPath id="avatarClipProfile">
                      <circle cx="12" cy="12" r="10.2" />
                    </clipPath>
                  </defs>

                  <g
                    clipPath="url(#avatarClipProfile)"
                    transform="translate(0,3)"
                  >
                    <rect
                      x="0"
                      y="18.5"
                      width="24"
                      height="6"
                      fill="currentColor"
                    />
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
                className="absolute right-0 z-[9999] mt-3 w-72 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white text-sm font-semibold text-black dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Profilbilde"
                        className="h-full w-full object-cover"
                      />
                    ) : user?.photoURL ? (
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
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                      >
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
                    setActiveTab("security");
                  }}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                      >
                        <path
                          d="M6 10V7a6 6 0 1 1 12 0v3"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <rect
                          x="4"
                          y="10"
                          width="16"
                          height="10"
                          rx="2"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                    </span>
                    <span className="text-sm font-medium">Sikkerhet</span>
                  </div>
                  <span className="text-slate-400">›</span>
                </button>

                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                      >
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
                  className="flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                >
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
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="h-[calc(100dvh-4rem)] bg-[#F6F8FF] dark:bg-slate-950">
        <div className="grid h-full grid-cols-[240px_1fr]">
          <aside className="flex flex-col justify-between border-r border-slate-200 bg-[#F6F8FF] p-6 dark:border-slate-800 dark:bg-slate-950">
            <div className="space-y-2">
              <button
                onClick={() => setActiveTab("profile")}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeTab === "profile"
                    ? "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-white"
                    : "text-slate-900 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <path
                    d="M4 20h4l10-10a2.1 2.1 0 0 0-4-4L4 16v4Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
                Endre profil
              </button>

              <button
                onClick={() => setActiveTab("security")}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeTab === "security"
                    ? "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-white"
                    : "text-slate-900 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <path
                    d="M6 10V7a6 6 0 1 1 12 0v3"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <rect
                    x="4"
                    y="10"
                    width="16"
                    height="10"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
                Sikkerhet
              </button>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-red-100 hover:text-red-600 dark:text-slate-300 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            >
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
              Logg ut
            </button>
          </aside>

          <section className="bg-[#F6F8FF] px-10 pt-4 pb-8 dark:bg-slate-950">
            {activeTab === "profile" && (
              <div className="mx-auto w-full max-w-2xl pt-1">
                <h1 className="mb-4 text-3xl font-bold text-slate-900 dark:text-slate-100">
                  Endre profil
                </h1>

                <div className="mb-6 flex flex-col items-center">
                  <div className="group relative h-28 w-28">
                    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-slate-300 dark:bg-slate-700">
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt="Profilbilde"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <svg viewBox="0 0 24 24" width="64" height="64" fill="none">
                          <path
                            d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
                            stroke="rgba(255,255,255,0.7)"
                            strokeWidth="2"
                          />
                          <path
                            d="M4 20c2-3.5 5-5 8-5s6 1.5 8 5"
                            stroke="rgba(255,255,255,0.7)"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </div>

                    <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/0 transition group-hover:bg-black/35">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoChange}
                      />

                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-900 opacity-0 shadow-md transition group-hover:opacity-100 dark:bg-slate-900 dark:text-slate-100">
                        <svg
                          viewBox="0 0 24 24"
                          width="18"
                          height="18"
                          fill="none"
                        >
                          <path
                            d="M4 7h4l2-2h4l2 2h4v12H4V7Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinejoin="round"
                          />
                          <circle
                            cx="12"
                            cy="13"
                            r="3"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                        </svg>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="w-full max-w-2xl">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                        Fornavn
                      </label>
                      <input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                        Etternavn
                      </label>
                      <input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="mt-6">
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Email
                    </label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="mt-6">
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Telefonnummer
                    </label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="mt-6 rounded-full border border-slate-900 bg-white px-6 py-2 text-base font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    {saving ? "Lagrer..." : "Lagre"}
                  </button>

                  {saveMessage && (
                    <div className="mt-3 text-sm text-green-600 dark:text-green-400">
                      {saveMessage}
                    </div>
                  )}

                  {saveError && (
                    <div className="mt-3 text-sm text-red-600 dark:text-red-400">
                      {saveError}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="mx-auto w-full max-w-2xl pt-1">
                <h1 className="mb-6 text-3xl font-bold text-slate-900 dark:text-slate-100">
                  Sikkerhet
                </h1>

                <div className="space-y-6">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Nåværende passord
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Nytt passord
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Gjenta passord
                    </label>
                    <input
                      type="password"
                      value={repeatPassword}
                      onChange={(e) => setRepeatPassword(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <button
                    onClick={handleSecuritySave}
                    disabled={saving}
                    className="rounded-full border border-slate-900 bg-white px-6 py-2 text-base font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    {saving ? "Lagrer..." : "Lagre"}
                  </button>

                  {saveMessage && activeTab === "security" && (
                    <div className="text-sm text-green-600 dark:text-green-400">
                      {saveMessage}
                    </div>
                  )}

                  {saveError && activeTab === "security" && (
                    <div className="text-sm text-red-600 dark:text-red-400">
                      {saveError}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}