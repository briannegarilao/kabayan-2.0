// apps/web/app/dashboard/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { Sidebar } from "../../components/dashboard/Sidebar";
import { Header } from "../../components/dashboard/Header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check — if no user, redirect to login
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the user's profile for the sidebar/header
  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role, barangay")
    .eq("id", user.id)
    .single();

  const userProfile = {
    fullName: profile?.full_name ?? "User",
    role: profile?.role ?? "lgu_admin",
    barangay: profile?.barangay ?? "",
    email: user.email ?? "",
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar — fixed left */}
      <Sidebar userProfile={userProfile} />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header bar */}
        <Header userProfile={userProfile} />

        {/* Page content — scrollable */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
