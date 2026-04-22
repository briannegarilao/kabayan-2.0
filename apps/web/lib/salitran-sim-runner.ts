// apps/web/lib/salitran-sim-runner.ts
"use client";

import { createClient } from "./supabase/client";
import {
  SALITRAN_IV_NAME,
  startSalitranSimulationSession,
  type SalitranRunMode,
  type SalitranScenarioDef,
} from "./salitran-sim";
import { postDevReset, postForceResponderStatus, postSeedSOS } from "./dev-api";
import {
  appendClientSimulationFeed,
  clearClientSimulationFeed,
} from "./salitran-sim-feed";

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

  clearClientSimulationFeed();
  appendClientSimulationFeed({
    level: "INFO",
    event: "scenario_preparing",
    title: "Scenario Preparing",
    message: `Preparing ${scenario.title}.`,
  });

  await postDevReset("full");
  notes.push("Previous simulation state was fully reset.");

  appendClientSimulationFeed({
    level: "INFO",
    event: "scenario_reset_complete",
    title: "Simulation Reset",
    message: "Previous simulation state was cleared.",
  });

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

    appendClientSimulationFeed({
      level: "INFO",
      event: "evac_opened",
      title: "Evac Ready",
      message: `Opened ${evacRows.length} Salitran IV evac center row(s).`,
    });
  }

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

    stagedResponderIds.push(forceResult?.responder?.id ?? responder.id);
  }

  appendClientSimulationFeed({
    level: "INFO",
    event: "responders_staged",
    title: "Responders Staged",
    message: `Staged ${stagedResponderIds.length} responder(s).`,
  });

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

  appendClientSimulationFeed({
    level: "INFO",
    event: "incident_seeding_complete",
    title: "Incidents Seeded",
    message: `Seeded ${seededIncidentIds.length} fixed incident(s).`,
  });

  startSalitranSimulationSession(scenario, {
    runMode,
    seededIncidentIds,
    stagedResponderIds,
    openedEvacNames,
    notes,
    status: "prepared",
  });

  appendClientSimulationFeed({
    level: "INFO",
    event: "scenario_prepared",
    title: "Scenario Prepared",
    message:
      runMode === "setup_only"
        ? "Scenario prepared without triggering the engine."
        : "Scenario prepared and assignment engine triggered.",
  });

  return {
    openedEvacNames,
    stagedResponderIds,
    seededIncidentIds,
    notes,
  };
}
