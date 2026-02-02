import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Filter out soft-deleted items from a query
 */
export const excludeDeleted = <T extends { deletedAt?: number }>(
  items: T[]
): T[] => {
  return items.filter((item) => item.deletedAt === undefined);
};

/**
 * Filter to only soft-deleted items (for trash)
 */
export const onlyDeleted = <T extends { deletedAt?: number }>(
  items: T[]
): T[] => {
  return items.filter((item) => item.deletedAt !== undefined);
};

/**
 * Check if an item is soft-deleted
 */
export const isDeleted = <T extends { deletedAt?: number }>(item: T): boolean => {
  return item.deletedAt !== undefined;
};

/**
 * Soft delete an item by setting deletedAt and deletedBy
 */
export const softDeleteFields = (deletedBy: Id<"adminUsers">) => ({
  deletedAt: Date.now(),
  deletedBy,
});

/**
 * Restore an item by clearing deletedAt and deletedBy
 */
export const restoreFields = () => ({
  deletedAt: undefined,
  deletedBy: undefined,
});

/**
 * Get timestamp 30 days ago (for permanent delete threshold)
 */
export const getExpirationThreshold = (): number => {
  return Date.now() - 30 * 24 * 60 * 60 * 1000;
};
