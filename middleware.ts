import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isAuthRoute = createRouteMatcher(["/login"]);
const isProtectedRoute = createRouteMatcher(["/jobs(.*)", "/applications(.*)", "/settings(.*)", "/onboarding(.*)"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  // getToken() reads the JWT cookie locally — no Convex network call.
  // isAuthenticated() does a fetchQuery on every request which fails silently
  // and causes a redirect loop when the Convex URL isn't reachable in the
  // Edge runtime. A present token is sufficient proof for routing; Convex
  // validates it when actual queries run.
  const token = await convexAuth.getToken();
  const isSignedIn = token !== undefined;

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
