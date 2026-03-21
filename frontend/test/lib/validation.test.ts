import { describe, expect, it } from "vitest";
import {
  ChatRequestSchema,
  HealthResponseSchema,
  LoginRequestSchema,
  StatsResponseSchema,
  validateResponse,
} from "../../lib/validation";

describe("Zod validation schemas", () => {
  describe("LoginRequestSchema", () => {
    it("should accept valid login request", () => {
      const result = LoginRequestSchema.safeParse({ email: "user@test.com", password: "secret" });
      expect(result.success).toBe(true);
    });

    it("should reject empty email", () => {
      const result = LoginRequestSchema.safeParse({ email: "", password: "secret" });
      expect(result.success).toBe(false);
    });

    it("should reject missing password", () => {
      const result = LoginRequestSchema.safeParse({ email: "user@test.com" });
      expect(result.success).toBe(false);
    });
  });

  describe("ChatRequestSchema", () => {
    it("should accept valid chat request", () => {
      const result = ChatRequestSchema.safeParse({
        messages: [{ role: "user", content: "Hello" }],
        index_name: "test-index",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty messages array", () => {
      const result = ChatRequestSchema.safeParse({ messages: [] });
      expect(result.success).toBe(false);
    });

    it("should reject invalid role", () => {
      const result = ChatRequestSchema.safeParse({
        messages: [{ role: "invalid", content: "Hi" }],
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty content", () => {
      const result = ChatRequestSchema.safeParse({
        messages: [{ role: "user", content: "" }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("HealthResponseSchema", () => {
    it("should accept valid health response", () => {
      const data = {
        status: "ok",
        service: "honeypot",
        mode: "demo",
        config_valid: false,
        allowed_origins_count: 5,
        requests_total: 0,
        errors_total: 0,
        error_rate: 0,
        diagnostics: { runtime_mode: "demo", next_action: "test" },
        capabilities: ["doc-ingest"],
        links: { health: "/api/health" },
      };
      const result = HealthResponseSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("StatsResponseSchema", () => {
    it("should accept valid stats response", () => {
      const data = {
        total_documents: 5,
        recent_uploads: 3,
        status: "Active",
      };
      const result = StatsResponseSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("validateResponse helper", () => {
    it("should return data when valid", () => {
      const data = { total_documents: 1, recent_uploads: 1, status: "ok" };
      const result = validateResponse(StatsResponseSchema, data, "test");
      expect(result.total_documents).toBe(1);
    });

    it("should return raw data when invalid (graceful degradation)", () => {
      const data = { unexpected: true };
      const result = validateResponse(StatsResponseSchema, data, "test");
      expect((result as any).unexpected).toBe(true);
    });
  });
});
