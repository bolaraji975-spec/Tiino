"use client";

/**
 * /jobs/[id] — redirect to split-screen feed with the job pre-selected.
 *
 * The canonical job detail view now lives at /jobs?id=[id] (right panel).
 * This route exists only for backward-compatibility / direct deep-links.
 */

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

function JobRedirectInner({ id }: { id: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/jobs?id=${id}`);
  }, [id, router]);

  return null;
}

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <JobRedirectInner id={id} />;
}
