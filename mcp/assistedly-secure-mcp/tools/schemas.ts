/**
 * Zod schemas for all exposed tools.
 * Strict validation; undeclared parameters rejected.
 */

import { z } from "zod";

export const FindMatchingOptionsSchema = z.object({
  consentedCaseId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  criteria: z.object({
    careNeeds: z.enum(["assisted", "memory", "skilled", "independent"]).optional(),
    budget: z.enum(["under_4000", "4000_6000", "6000_8000", "8000_10000", "over_10000"]).optional(),
    location: z.enum(["boston", "worcester", "springfield", "anywhere"]).optional(),
    timing: z.enum(["immediate", "soon", "planning", "exploring"]).optional(),
    priorities: z.array(z.string()).max(5).optional(),
  }).strict(),
  maxResults: z.number().int().min(1).max(25).default(10),
}).strict();

export const GetOptionSummarySchema = z.object({
  optionId: z.number().int().positive(),
}).strict();

export const CreateFollowUpDraftSchema = z.object({
  consentedCaseId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  optionIds: z.array(z.number().int().positive()).min(1).max(10),
  followUpType: z.enum(["email_family", "email_facility", "internal_note"]).default("email_family"),
}).strict();

export const GetBusinessContextSchema = z.object({
  phase: z.enum(["NOW", "NEXT", "LATER", "ALL"]).default("ALL"),
}).strict();

export type FindMatchingOptionsInput = z.infer<typeof FindMatchingOptionsSchema>;
export type GetOptionSummaryInput = z.infer<typeof GetOptionSummarySchema>;
export type CreateFollowUpDraftInput = z.infer<typeof CreateFollowUpDraftSchema>;
export type GetBusinessContextInput = z.infer<typeof GetBusinessContextSchema>;
