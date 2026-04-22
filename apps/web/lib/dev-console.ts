// apps/web/lib/dev-console.ts
export function isDevConsoleEnabledForClient(role?: string | null): boolean {
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? "development";
  const enabled = process.env.NEXT_PUBLIC_DEV_CONSOLE_ENABLED === "true";
  const allowAdminOutsideDev =
    process.env.NEXT_PUBLIC_DEV_CONSOLE_ADMIN_ENABLED === "true";

  if (!enabled) return false;

  if (appEnv === "development") return true;

  if (allowAdminOutsideDev && role === "lgu_admin") return true;

  return false;
}
