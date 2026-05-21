import type { User } from "firebase/auth";
import type { ReactNode } from "react";

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element;

export function useAuth(): {
  user: User | null;
  loading: boolean;
};

