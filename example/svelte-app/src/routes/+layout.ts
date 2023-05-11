import type { PageLoad } from "./$types";

export const load = (async ({ setHeaders }) => {
  setHeaders({
    "cache-control": "max-age=0, no-cache, no-store, must-revalidate",
  });
}) satisfies PageLoad;
