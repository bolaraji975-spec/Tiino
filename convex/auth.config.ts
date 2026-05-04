/**
 * auth.config.ts
 *
 * Configures the JWT issuer for Convex Auth.
 * CONVEX_SITE_URL is set automatically by Convex when you deploy.
 * For local dev, set it via: npx convex env set CONVEX_SITE_URL <url>
 */
const authConfig = {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
