// components/AnnouncementCard.tsx
import React from "react";
import { View, Text } from "react-native";

interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: string;
  created_at: string;
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: "#dc262620", text: "#ef4444", label: "CRITICAL" },
  warning: { bg: "#f59e0b20", text: "#f59e0b", label: "WARNING" },
  info: { bg: "#3b82f620", text: "#3b82f6", label: "INFO" },
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

export default function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const priority = PRIORITY_COLORS[announcement.priority] || PRIORITY_COLORS.info;

  return (
    <View
      style={{
        backgroundColor: "#1e293b",
        borderRadius: 12,
        padding: 16,
        marginBottom: 10,
        borderLeftWidth: 3,
        borderLeftColor: priority.text,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <View style={{ backgroundColor: priority.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ color: priority.text, fontSize: 10, fontWeight: "700" }}>
            {priority.label}
          </Text>
        </View>
        <Text style={{ color: "#64748b", fontSize: 11 }}>{timeAgo(announcement.created_at)}</Text>
      </View>

      <Text style={{ color: "#e2e8f0", fontSize: 14, fontWeight: "600", marginBottom: 4 }}>
        {announcement.title}
      </Text>
      <Text style={{ color: "#94a3b8", fontSize: 13, lineHeight: 18 }}>
        {announcement.body}
      </Text>
    </View>
  );
}
