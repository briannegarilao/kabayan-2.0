// packages/database/realtime.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./supabase-types";

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    realtime: {
      params: {
        eventsPerSecond: 10, // Throttle: max 10 realtime events/second to client
      },
    },
  },
);
