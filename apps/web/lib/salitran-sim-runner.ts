"use client";

import { createClient } from "./supabase/client";
import {
  SALITRAN_IV_NAME,
  startSalitranSimulationSession,
  type SalitranRunMode,
  type SalitranScenarioDef,
} from "./salitran-sim";
import { postDevReset, postForceResponderStatus, postSeedSOS } from "./dev-api";

interface PreparedRunSummary {
  openedEvacNames: string[];
  stagedResponderIds: string[];
  seededIncidentIds: string[];
  notes: string[];
}

export async function prepareSalitranScenarioRun(params: {
  scenario: SalitranScenarioDef;
  runMode: SalitranRunMode;
}): Promise<PreparedRunSummary> {
  const { scenario, runMode } = params;
  const supabase = createClient();

  const notes: string[] = [];
  const stagedResponderIds: string[] = [];
  const seededIncidentIds: string[] = [];
  const openedEvacNames: string[] = [];

  // 1) Always reset previous simulation state first
  await postDevReset("full");
  notes.push("Previous simulation state was fully reset.");

  // 2) Open Salitran IV evac center rows if present
  const evacLookup = await supabase
    .from("evacuation_centers")
    .select("id, name, barangay")
    .eq("barangay", SALITRAN_IV_NAME);

  if (evacLookup.error) {
    throw new Error(
      `Failed to load Salitran IV evac centers: ${evacLookup.error.message}`,
    );
  }

  const evacRows = evacLookup.data ?? [];

  if (evacRows.length > 0) {
    const updateResult = await supabase
      .from("evacuation_centers")
      .update({
        is_open: true,
        current_occupancy: 0,
      })
      .eq("barangay", SALITRAN_IV_NAME);

    if (updateResult.error) {
      throw new Error(
        `Failed to open Salitran IV evac centers: ${updateResult.error.message}`,
      );
    }

    openedEvacNames.push(...evacRows.map((row) => row.name));
    notes.push(`Opened ${evacRows.length} Salitran IV evac center row(s).`);
  } else {
    notes.push(
      "No existing Salitran IV evac center rows found. Phase 3 continued without DB evac activation.",
    );
  }

  // 3) Resolve responders to stage
  const responderLookup = await supabase
    .from("responders")
    .select("id")
    .order("id", { ascending: true })
    .limit(scenario.responderStaging.length);

  if (responderLookup.error) {
    throw new Error(
      `Failed to load responders for staging: ${responderLookup.error.message}`,
    );
  }

  const responderRows = responderLookup.data ?? [];
  if (responderRows.length === 0) {
    throw new Error(
      "No responders found to stage for the Salitran IV simulation.",
    );
  }

  // 4) Force responder statuses and locations
  for (let i = 0; i < responderRows.length; i++) {
    const responder = responderRows[i];
    const staging = scenario.responderStaging[i];

    if (!staging) continue;

    const forceResult = await postForceResponderStatus({
      responder_id: responder.id,
      is_available: true,
      reset_load: true,
      clear_current_incident: true,
      latitude: staging.lat,
      longitude: staging.lng,
    });

    if (forceResult?.responder?.id) {
      stagedResponderIds.push(forceResult.responder.id);
    } else {
      stagedResponderIds.push(responder.id);
    }
  }

  notes.push(
    `Staged ${stagedResponderIds.length} responder(s) for ${scenario.title}.`,
  );

  // 5) Seed incidents
  for (let i = 0; i < scenario.incidentSeeds.length; i++) {
    const seed = scenario.incidentSeeds[i];
    const isLast = i === scenario.incidentSeeds.length - 1;

    const seedResult = await postSeedSOS({
      barangay: SALITRAN_IV_NAME,
      count: 1,
      people_count: seed.peopleCount,
      message: `[SIM][${scenario.title}] ${seed.requesterName} — ${seed.message}`,
      latitude: seed.lat,
      longitude: seed.lng,
      simulation_label: `salitran-iv:${scenario.id}`,
      cluster: false,
      run_engine_after_seed: runMode === "setup_and_trigger" && isLast,
    });

    const ids = seedResult?.result?.seeded_incident_ids ?? [];
    seededIncidentIds.push(...ids);
  }

  notes.push(`Seeded ${seededIncidentIds.length} incident(s).`);

  if (runMode === "setup_only") {
    notes.push("Scenario prepared without triggering the assignment engine.");
  } else {
    notes.push(
      "Scenario prepared and the assignment engine was triggered on the final seed.",
    );
  }

  // 6) Persist client-side session state
  startSalitranSimulationSession(scenario, {
    runMode,
    seededIncidentIds,
    stagedResponderIds,
    openedEvacNames,
    notes,
    status: "prepared",
  });

  return {
    openedEvacNames,
    stagedResponderIds,
    seededIncidentIds,
    notes,
  };
}
