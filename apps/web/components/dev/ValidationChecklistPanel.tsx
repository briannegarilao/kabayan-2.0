// apps/web/components/dev/ValidationChecklistPanel.tsx
"use client";

const DEFAULT_ITEMS = [
  "Seeded SOS creates incident rows successfully",
  "Assignment engine produces responder selection",
  "Trip plan is created for simulated assignment",
  "Responder force-status updates correctly",
  "Trip accept / pickup / dropoff still work",
  "Reset returns environment to expected baseline",
  "Realtime logs still stream from database changes",
  "No capacity violation occurs during progression",
  "Starvation scenario still escalates old incidents",
  "Decline and reassignment scenario still works",
];

export function ValidationChecklistPanel({
  checks,
  setChecks,
}: {
  checks: Record<string, boolean>;
  setChecks: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  function toggle(label: string) {
    setChecks((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  }

  const completed = DEFAULT_ITEMS.filter((item) => checks[item]).length;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-200">
          Validation Checklist
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Use this before demos or after backend changes
        </p>
      </div>

      <div className="mb-3 rounded-lg border border-gray-800 bg-gray-950/50 p-3 text-xs text-gray-400">
        Completed: <span className="font-semibold text-white">{completed}</span>{" "}
        / {DEFAULT_ITEMS.length}
      </div>

      <div className="space-y-2">
        {DEFAULT_ITEMS.map((item) => (
          <label
            key={item}
            className="flex items-start gap-3 rounded-lg border border-gray-800 bg-gray-950/40 p-3 text-sm text-gray-300"
          >
            <input
              type="checkbox"
              checked={Boolean(checks[item])}
              onChange={() => toggle(item)}
              className="mt-0.5"
            />
            <span>{item}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
