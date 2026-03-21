import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger, getRequestId, setRequestId } from "../../lib/logger";

describe("structured logger", () => {
  beforeEach(() => {
    setRequestId("");
  });

  it("should create a logger with all levels", () => {
    const logger = createLogger("TestComponent");
    expect(logger.debug).toBeTypeOf("function");
    expect(logger.info).toBeTypeOf("function");
    expect(logger.warn).toBeTypeOf("function");
    expect(logger.error).toBeTypeOf("function");
  });

  it("should emit info logs with component name", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = createLogger("App");
    logger.info("test message");
    expect(spy).toHaveBeenCalledTimes(1);
    const args = spy.mock.calls[0];
    expect(args[0]).toContain("[INFO]");
    expect(args[0]).toContain("[App]");
    spy.mockRestore();
  });

  it("should emit error logs to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createLogger("Service");
    logger.error("something broke", { code: 500 });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("should include requestId when set", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    setRequestId("req-abc123");
    expect(getRequestId()).toBe("req-abc123");
    const logger = createLogger("X");
    logger.info("with request id");
    expect(spy.mock.calls[0][0]).toContain("req=req-abc123");
    spy.mockRestore();
  });
});
