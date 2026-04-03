// contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../utils/supabase";

interface UserProfile {
  id: string;
  full_name: string | null;
  role: string;
  barangay: string | null;
  phone_number: string | null;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    barangay: string,
    phone: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    isLoading: true,
    isAuthenticated: false,
  });

  async function fetchProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, role, barangay, phone_number")
        .eq("id", userId)
        .maybeSingle();
      if (error || !data) return null;
      return data as UserProfile;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id).then((profile) => {
          setState({
            session,
            user: session.user,
            profile,
            isLoading: false,
            isAuthenticated: true,
          });
        });
      } else {
        setState((s) => ({ ...s, isLoading: false }));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          setState({
            session,
            user: session.user,
            profile,
            isLoading: false,
            isAuthenticated: true,
          });
        } else {
          setState({
            session: null,
            user: null,
            profile: null,
            isLoading: false,
            isAuthenticated: false,
          });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signUp(
    email: string,
    password: string,
    fullName: string,
    barangay: string,
    phone: string
  ) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (authError) return { error: authError.message };
    if (!authData.user) return { error: "Registration failed." };

    // Insert into public.users — matches ACTUAL table columns
    const { error: profileError } = await supabase.from("users").insert({
      id: authData.user.id,
      full_name: fullName,
      role: "citizen",
      barangay,
      phone_number: phone || null,
    });

    if (profileError) {
      console.warn("Profile insert failed:", profileError.message);
    }

    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}