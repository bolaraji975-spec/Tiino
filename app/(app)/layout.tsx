/**
 * Authenticated app shell layout.
 *
 * Wraps all routes under app/(app)/ with the AppNav sidebar.
 * Auth guard lives in AppNav (client component) — it redirects
 * unauthenticated users to /login via useEffect + router.replace.
 *
 * Structure:
 *   <div flex row>
 *     <AppNav />          ← 220px sticky sidebar
 *     <main flex col>     ← grows to fill remaining width
 *       {children}
 *     </main>
 *   </div>
 */

import AppNav from "@/components/AppNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "#021e1e",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <AppNav />
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        {children}
      </main>
    </div>
  );
}
