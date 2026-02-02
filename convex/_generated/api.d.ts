/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminUsers from "../adminUsers.js";
import type * as alliances from "../alliances.js";
import type * as blogPosts from "../blogPosts.js";
import type * as cleanupTrash from "../cleanupTrash.js";
import type * as clients from "../clients.js";
import type * as crons from "../crons.js";
import type * as files from "../files.js";
import type * as model_auth from "../model/auth.js";
import type * as model_softDelete from "../model/softDelete.js";
import type * as newsletter from "../newsletter.js";
import type * as projectAchievements from "../projectAchievements.js";
import type * as projects from "../projects.js";
import type * as seedContent from "../seedContent.js";
import type * as services from "../services.js";
import type * as stats from "../stats.js";
import type * as teamMembers from "../teamMembers.js";
import type * as trash from "../trash.js";
import type * as updateUrls from "../updateUrls.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminUsers: typeof adminUsers;
  alliances: typeof alliances;
  blogPosts: typeof blogPosts;
  cleanupTrash: typeof cleanupTrash;
  clients: typeof clients;
  crons: typeof crons;
  files: typeof files;
  "model/auth": typeof model_auth;
  "model/softDelete": typeof model_softDelete;
  newsletter: typeof newsletter;
  projectAchievements: typeof projectAchievements;
  projects: typeof projects;
  seedContent: typeof seedContent;
  services: typeof services;
  stats: typeof stats;
  teamMembers: typeof teamMembers;
  trash: typeof trash;
  updateUrls: typeof updateUrls;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
