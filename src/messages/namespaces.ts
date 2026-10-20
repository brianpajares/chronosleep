/** Top-level catalog namespaces shipped to the browser, per route group (keeps client payloads small). */
export const BASE_CLIENT_NAMESPACES = ['site', 'common', 'errors', 'nav', 'cookies'] as const;

export const FUNNEL_NAMESPACES = [
  ...BASE_CLIENT_NAMESPACES,
  'progress',
  'steps',
  'wizard',
  'result',
  'preview',
  'processing',
  'gate',
  'success',
  'checkout',
  'report',
  'rights',
] as const;
