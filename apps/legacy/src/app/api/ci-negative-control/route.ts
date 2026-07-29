import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";

// TEMPORARY — negative control for the CI `build` job (T-infra-011 AC-3).
// This file is committed only to prove the build job goes RED on a genuine
// build break, then reverted in the immediately following commit. It must never
// survive on the branch.
//
// It reproduces the exact failure shape that kept `build` out of CI: a Convex
// client constructed at MODULE scope from a variable that is never set, so
// `next build`'s page-data collection throws "Client created with undefined
// deployment address". Deliberately lint-clean and typecheck-clean, because the
// point is that neither of those jobs can catch it.
export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(
  process.env.NEXT_PUBLIC_CI_NEGATIVE_CONTROL_UNSET_URL!
);

export async function GET() {
  return NextResponse.json({ client: typeof convex });
}
