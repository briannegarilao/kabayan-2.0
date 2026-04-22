// apps/web/components/dashboard/SalitranSimulationModeSync.tsx
"use client";

import { useEffect } from "react";
import { useBarangayFilter } from "../../lib/barangay-filter";
import {
  SALITRAN_IV_NAME,
  readSalitranSimulationSession,
} from "../../lib/salitran-sim";

export function SalitranSimulationModeSync() {
  const { selectedBarangay, setSelectedBarangay } = useBarangayFilter();

  useEffect(() => {
    const session = readSalitranSimulationSession();
    if (!session || session.mode !== "salitran-iv") return;

    if (selectedBarangay !== SALITRAN_IV_NAME) {
      setSelectedBarangay(SALITRAN_IV_NAME);
    }
  }, [selectedBarangay, setSelectedBarangay]);

  return null;
}
