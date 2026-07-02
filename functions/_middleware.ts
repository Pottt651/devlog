// Authentication is intentionally disabled. Keep the middleware as a pass-through
// so every page and API route remains publicly accessible.
export const onRequest: PagesFunction = (context) => context.next();
