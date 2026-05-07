import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isAuthRoute = createRouteMatcher(["/login"]);
const isProtectedRoute = createRouteMatcher(["/jobs(.*)", "/applications(.*)", "/settings(.*)", "/onboarding(.*)"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const isSignedIn = await convexAuth.isAuthenticated();

  // Redirect signed-in users away from the login page
  if (isAuthRoute(request) && isSignedIn) {
    return nextjsMiddlewareRedirect(request, "/jobs");
  }

  // Redirect unauthenticated users to login for protected routes
  if (isProtectedRoute(request) && !isSignedIn) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
});

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
