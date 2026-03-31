// apps/web/app/dashboard/announcements/page.tsx
"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Megaphone, Send, Loader2, AlertTriangle, Info, AlertCircle, Trash2 } from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { DASMARINAS_BARANGAYS } from "../../../lib/map-config";

const supabase = createClient();

interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: "info" | "warning" | "critical";
  target_audience: string[];
  barangay: string | null;
  is_active: boolean;
  created_at: string;
}

const PRIORITY_STYLES = {
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-500/20" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-500/20" },
  critical: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-400/10", border: "border-red-500/20" },
};

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"info" | "warning" | "critical">("info");
  const [audience, setAudience] = useState<string[]>(["all"]);
  const [barangay, setBarangay] = useState<string>("");

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("announcements")
        .select("id, title, body, priority, target_audience, barangay, is_active, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      setAnnouncements((data as Announcement[]) || []);
      setIsLoading(false);
    }
    fetch();

    // Real-time: new announcements appear instantly
    const channel = supabase
      .channel("announcements-feed")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "announcements",
      }, (payload) => {
        setAnnouncements((prev) => [payload.new as Announcement, ...prev].slice(0, 50));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function handleSubmit() {
    if (!title.trim() || !body.trim()) return;

    setSending(true);

    // Get current user for created_by
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("announcements").insert({
      title: title.trim(),
      body: body.trim(),
      priority,
      target_audience: audience,
      barangay: barangay || null,
      created_by: user?.id,
      is_active: true,
    });

    setSending(false);

    if (error) {
      console.error("Failed to create announcement:", error.message);
      alert("Failed: " + error.message);
      return;
    }

    // Reset form (real-time subscription will add it to the list)
    setTitle("");
    setBody("");
    setPriority("info");
    setAudience(["all"]);
    setBarangay("");
  }

  async function toggleActive(id: string, currentlyActive: boolean) {
    const { error } = await supabase
      .from("announcements")
      .update({ is_active: !currentlyActive })
      .eq("id", id);

    if (!error) {
      setAnnouncements((prev) =>
        prev.map((a) => a.id === id ? { ...a, is_active: !currentlyActive } : a)
      );
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {/* Left: Compose */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Send className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-medium text-gray-200">New Announcement</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] uppercase text-gray-500">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Flood Warning: Langkaan Area"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase text-gray-500">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Residents near Langkaan Creek are advised to evacuate immediately..."
              rows={4}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase text-gray-500">Priority</label>
            <div className="flex gap-2">
              {(["info", "warning", "critical"] as const).map((p) => {
                const style = PRIORITY_STYLES[p];
                return (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      priority === p
                        ? `${style.border} ${style.bg} ${style.color}`
                        : "border-gray-700 text-gray-500 hover:border-gray-600"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase text-gray-500">Target Audience</label>
            <select
              value={audience[0]}
              onChange={(e) => setAudience([e.target.value])}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-blue-500"
            >
              <option value="all">All (Citizens + Responders)</option>
              <option value="citizens">Citizens Only</option>
              <option value="responders">Responders Only</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase text-gray-500">Barangay (optional)</label>
            <select
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-blue-500"
            >
              <option value="">Citywide (All Barangays)</option>
              {DASMARINAS_BARANGAYS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSubmit}
            disabled={sending || !title.trim() || !body.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Megaphone className="h-3.5 w-3.5" />}
            {sending ? "Sending..." : "Broadcast Announcement"}
          </button>
        </div>
      </div>

      {/* Right: Recent announcements */}
      <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h3 className="mb-4 text-sm font-medium text-gray-200">Recent Announcements</h3>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-500">
            No announcements yet. Create one to get started.
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {announcements.map((a) => {
              const style = PRIORITY_STYLES[a.priority];
              const PIcon = style.icon;

              return (
                <div
                  key={a.id}
                  className={`rounded-lg border p-4 ${
                    a.is_active ? style.border : "border-gray-800 opacity-50"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <PIcon className={`h-4 w-4 ${style.color}`} />
                      <h4 className="text-sm font-medium text-gray-200">{a.title}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.color} ${style.bg}`}>
                        {a.priority}
                      </span>
                      <button
                        onClick={() => toggleActive(a.id, a.is_active)}
                        className="text-gray-600 hover:text-gray-400"
                        title={a.is_active ? "Deactivate" : "Reactivate"}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <p className="mb-2 text-xs text-gray-400">{a.body}</p>

                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    <span>To: {a.target_audience.join(", ")}</span>
                    {a.barangay && <span>&middot; {a.barangay}</span>}
                    <span className="ml-auto">
                      {format(new Date(a.created_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
