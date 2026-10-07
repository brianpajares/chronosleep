import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Locale negotiation/rewrites for the public site. API, admin and static files are excluded.
export default createMiddleware(routing);

export const config = {
  matcher: ['/((?!api|admin|_next|_vercel|monitoring|.*\\..*).*)'],
};
