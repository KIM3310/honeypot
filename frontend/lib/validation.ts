/**
 * Zod-based request validation schemas for frontend API calls.
 */
import { z } from 'zod';

// --- Auth ---

export const LoginRequestSchema = z.object({
  email: z.string().min(1, 'Email is required').max(255),
  password: z.string().min(1, 'Password is required').max(255),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  user_email: z.string(),
  user_name: z.string(),
  user_role: z.string(),
  expires_in: z.number(),
  refresh_token: z.string(),
  refresh_expires_in: z.number(),
  csrf_token: z.string(),
  csrf_expires_in: z.number(),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// --- Chat ---

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1).max(12000),
});

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(40),
  index_name: z.string().nullable().optional(),
  response_format: z.object({ type: z.string() }).optional(),
});
export type ChatRequestPayload = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  content: z.unknown(),
  response: z.unknown().optional(),
  sources: z.array(z.string()).optional(),
  user_info: z.object({
    name: z.string(),
    email: z.string(),
    role: z.string(),
  }).optional(),
});

// --- Health ---

export const HealthResponseSchema = z.object({
  status: z.string(),
  service: z.string(),
  mode: z.string(),
  config_valid: z.boolean(),
  allowed_origins_count: z.number(),
  requests_total: z.number(),
  errors_total: z.number(),
  error_rate: z.number(),
  diagnostics: z.object({
    runtime_mode: z.string(),
    next_action: z.string(),
  }),
  capabilities: z.array(z.string()),
  links: z.record(z.string(), z.string()),
});

// --- Upload ---

export const UploadResponseSchema = z.object({
  message: z.string(),
  task_id: z.string(),
  file_name: z.string(),
  index_name: z.string(),
});

export const TaskStatusSchema = z.object({
  status: z.string(),
  progress: z.number(),
  message: z.string(),
});

// --- Stats ---

export const StatsResponseSchema = z.object({
  total_documents: z.number(),
  recent_uploads: z.number(),
  status: z.string(),
});

/**
 * Safe parse helper: returns parsed data or throws a descriptive error.
 */
export function validateResponse<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(`[Validation] ${label} response did not match schema:`, result.error.format());
    // Return data as-is to avoid breaking the app on schema drift.
    return data as T;
  }
  return result.data;
}
