import type { Responder } from "./types";

export function normalizeBarangay(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

export function matchesResponderBarangay(
  responder: Pick<Responder, "home_barangay" | "team_name">,
  selectedBarangay: string,
) {
  const target = normalizeBarangay(selectedBarangay);
  if (!target) return true;

  if (normalizeBarangay(responder.home_barangay) === target) {
    return true;
  }

  return responder.team_name?.toLowerCase().includes(target) ?? false;
}
