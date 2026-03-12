import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../firebase";

function mapFirebaseAuthError(error) {
  const code = error?.code ?? "";

  switch (code) {
    case "auth/invalid-email":
      return "Ugyldig e-postadresse.";

    case "auth/user-disabled":
      return "Denne brukeren er deaktivert.";

    case "auth/user-not-found":
      return "Fant ingen bruker med denne e-posten.";

    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Feil e-post eller passord.";

    case "auth/email-already-in-use":
      return "Denne e-posten er allerede i bruk.";

    case "auth/weak-password":
      return "Passordet må være minst 6 tegn.";

    case "auth/missing-password":
      return "Du må skrive inn et passord.";

    case "auth/missing-email":
      return "Du må skrive inn en e-postadresse.";

    case "auth/too-many-requests":
      return "For mange forsøk. Prøv igjen litt senere.";

    case "auth/network-request-failed":
      return "Nettverksfeil. Sjekk internettforbindelsen din.";

    default:
      return "Noe gikk galt. Prøv igjen.";
  }
}

export function registerWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

export function logout() {
  return signOut(auth);
}

export function getAuthErrorMessage(error) {
  return mapFirebaseAuthError(error);
}