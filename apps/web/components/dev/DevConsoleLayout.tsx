// apps/web/components/dev/DevConsoleLayout.tsx
import { ReactNode } from "react";
import { Wrench } from "lucide-react";

export function DevConsoleLayout({
  banner,
  left,
  right,
}: {
  banner?: ReactNode;
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-400/10 p-4">
        <Wrench className="h-5 w-5 shrink-0 text-amber-400" />
        <div>
          <p className="text-sm font-medium text-amber-300">
            Developer Console
          </p>
          <p className="mt-0.5 text-xs text-amber-400/80">
            Internal tools for simulation, testing, and demo setup. Treat every
            action here as real state mutation unless explicitly labeled
            otherwise.
          </p>
        </div>
      </div>

      {banner}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">{left}</div>
        <div className="space-y-5">{right}</div>
      </div>
    </div>
  );
}
