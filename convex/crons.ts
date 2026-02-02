import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run daily at 3:00 AM UTC to clean up old trash items
crons.daily(
  "cleanup-old-trash",
  { hourUTC: 3, minuteUTC: 0 },
  internal.cleanupTrash.cleanupOldItems
);

export default crons;
