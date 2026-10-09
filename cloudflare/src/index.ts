import { handle, type Env } from "./handler";

/** Sync-only Worker entry (Worker + R2 + static UI). No Container export. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env);
  },
};
