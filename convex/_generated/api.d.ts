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
import type * as http from "../http.js";
import type * as lms_auth from "../lms/auth.js";
import type * as lms_courses from "../lms/courses.js";
import type * as lms_enrollments from "../lms/enrollments.js";
import type * as lms_manifest from "../lms/manifest.js";
import type * as lms_org from "../lms/org.js";
import type * as lms_packPricing from "../lms/packPricing.js";
import type * as lms_packs from "../lms/packs.js";
import type * as lms_payment_checkout from "../lms/payment/checkout.js";
import type * as lms_payment_email from "../lms/payment/email.js";
import type * as lms_payment_internal from "../lms/payment/internal.js";
import type * as lms_payment_ledger from "../lms/payment/ledger.js";
import type * as lms_payment_logging from "../lms/payment/logging.js";
import type * as lms_payment_mercadopago from "../lms/payment/mercadopago.js";
import type * as lms_payment_orders from "../lms/payment/orders.js";
import type * as lms_payment_types from "../lms/payment/types.js";
import type * as lms_payment_validation from "../lms/payment/validation.js";
import type * as lms_payment_webhook from "../lms/payment/webhook.js";
import type * as lms_scormEvents from "../lms/scormEvents.js";
import type * as model_auth from "../model/auth.js";
import type * as model_passwords from "../model/passwords.js";
import type * as model_softDelete from "../model/softDelete.js";
import type * as newsletter from "../newsletter.js";
import type * as projectAchievements from "../projectAchievements.js";
import type * as projects from "../projects.js";
import type * as seedContent from "../seedContent.js";
import type * as serviceBlocks from "../serviceBlocks.js";
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
  http: typeof http;
  "lms/auth": typeof lms_auth;
  "lms/courses": typeof lms_courses;
  "lms/enrollments": typeof lms_enrollments;
  "lms/manifest": typeof lms_manifest;
  "lms/org": typeof lms_org;
  "lms/packPricing": typeof lms_packPricing;
  "lms/packs": typeof lms_packs;
  "lms/payment/checkout": typeof lms_payment_checkout;
  "lms/payment/email": typeof lms_payment_email;
  "lms/payment/internal": typeof lms_payment_internal;
  "lms/payment/ledger": typeof lms_payment_ledger;
  "lms/payment/logging": typeof lms_payment_logging;
  "lms/payment/mercadopago": typeof lms_payment_mercadopago;
  "lms/payment/orders": typeof lms_payment_orders;
  "lms/payment/types": typeof lms_payment_types;
  "lms/payment/validation": typeof lms_payment_validation;
  "lms/payment/webhook": typeof lms_payment_webhook;
  "lms/scormEvents": typeof lms_scormEvents;
  "model/auth": typeof model_auth;
  "model/passwords": typeof model_passwords;
  "model/softDelete": typeof model_softDelete;
  newsletter: typeof newsletter;
  projectAchievements: typeof projectAchievements;
  projects: typeof projects;
  seedContent: typeof seedContent;
  serviceBlocks: typeof serviceBlocks;
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
