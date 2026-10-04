import { DraftContainer } from "./container";
import { handle, type Env } from "./handler";

export { DraftContainer };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env);
  },
};
