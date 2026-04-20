// apps/web/app/dashboard/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { Sidebar } from "../../components/dashboard/Sidebar";
import { Header } from "../../components/dashboard/Header";
import { BarangayFilterProvider } from "../../lib/barangay-filter";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the user's profile
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
    <BarangayFilterProvider
      userBarangay={userProfile.barangay || null}
      userRole={userProfile.role}
    >
      <div className="flex h-screen overflow-hidden bg-gray-950">
        <Sidebar userProfile={userProfile} />

        <div className="flex flex-1 flex-col overflow-hidden">
          <Header userProfile={userProfile} />

          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </BarangayFilterProvider>
  );
}
