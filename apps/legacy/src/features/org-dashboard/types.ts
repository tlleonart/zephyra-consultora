// E5 — Org-Admin dashboard view-model. Ids are carried as plain strings across
// the server→client boundary (Convex Id<> is a branded string; the client casts
// back to Id<> at the action call site). Course titles are joined server-side
// from listPublished — the dashboard never reads the admin-gated getById.

export interface OrgDashboardPack {
  seatPackId: string;
  courseId: string;
  courseTitle: string;
  courseSlug?: string;
  totalSeats: number; // total
  claimedSeats: number; // asignados
  availableSeats: number; // disponibles
}

export interface OrgDashboardMember {
  learnerId: string;
  email: string; // DISPLAY identity only — membership ≠ progress
  courseId: string;
  courseTitle: string;
  seatId: string;
  claimedAt?: number;
}

export interface OrgDashboardCourseProgress {
  courseId: string;
  courseTitle: string;
  totalClaimed: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  avgProgressPercent: number;
}

export interface OrgDashboardData {
  organizationId: string;
  organizationName: string;
  packs: OrgDashboardPack[];
  members: OrgDashboardMember[];
  progress: OrgDashboardCourseProgress[];
}
