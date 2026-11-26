import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
const PUBLIC_PATHS = ['/login', '/forgot-password'];
export async function middleware(request) {
    const { pathname } = request.nextUrl;
    // Always allow Next internals & static assets
    if (pathname.startsWith('/_next') ||
        pathname === '/favicon.ico' ||
        pathname.startsWith('/api/auth') ||
        pathname === '/api/health') {
        return NextResponse.next();
    }
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = await verifySessionToken(token);
    const isPublicPage = PUBLIC_PATHS.includes(pathname);
    // Redirect signed-in users away from login / forgot-password
    if (isPublicPage && session) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (isPublicPage) {
        return NextResponse.next();
    }
    // Block unauthenticated requests
    if (!session) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const loginUrl = new URL('/login', request.url);
        if (pathname !== '/') {
            loginUrl.searchParams.set('next', pathname);
        }
        return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
}
export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
