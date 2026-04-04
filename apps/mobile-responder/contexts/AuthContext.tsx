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

interface ResponderProfile {
  id: string;
  is_available: boolean;
  vehicle_type: string | null;
  team_name: string | null;
  max_capacity: number;
  current_load: number;
  current_incident_id: string | null;
  last_location_update: string | null;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  responder: ResponderProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshResponder: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    responder: null,
    isLoading: true,
    isAuthenticated: false,
  });

  async function fetchProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data } = await supabase
        .from("users")
        .select("id, full_name, role, barangay, phone_number")
        .eq("id", userId)
        .maybeSingle();
      return data as UserProfile | null;
    } catch {
      return null;
    }
  }

  async function fetchResponder(userId: string): Promise<ResponderProfile | null> {
    try {
      const { data } = await supabase
        .from("responders")
        .select("id, is_available, vehicle_type, team_name, max_capacity, current_load, current_incident_id, last_location_update")
        .eq("id", userId)
        .maybeSingle();
      return data as ResponderProfile | null;
    } catch {
      return null;
    }
  }

  async function loadUser(session: Session) {
    const userId = session.user.id;
    const [profile, responder] = await Promise.all([
      fetchProfile(userId),
      fetchResponder(userId),
    ]);

    setState({
      session,
      user: session.user,
      profile,
      responder,
      isLoading: false,
      isAuthenticated: true,
    });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUser(session);
      } else {
        setState((s) => ({ ...s, isLoading: false }));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          await loadUser(session);
        } else {
          setState({
            session: null,
            user: null,
            profile: null,
            responder: null,
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

  async function signOut() {
    await supabase.auth.signOut();
  }

  // Re-fetch responder data (after duty toggle, pickup, dropoff)
  async function refreshResponder() {
    if (!state.user) return;
    const responder = await fetchResponder(state.user.id);
    setState((s) => ({ ...s, responder }));
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, refreshResponder }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
