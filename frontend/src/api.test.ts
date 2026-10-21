import { afterEach, describe, expect, it, vi } from "vitest";
import { McpClient, displayValue } from "./api";

afterEach(() => vi.unstubAllGlobals());
describe("MCP client contract", () => {
  it("initializes, notifies and discovers required tools with bearer authentication", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: { protocolVersion: "2025-11-25" } }),
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: {
              tools: [{ name: "ask_question" }, { name: "save_query" }],
            },
          }),
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(await new McpClient("/analytics", "test-token").connect()).toEqual([
      "ask_question",
      "save_query",
    ]);
    expect(fetcher.mock.calls.map((c) => JSON.parse(c[1].body).method)).toEqual(
      ["initialize", "notifications/initialized", "tools/list"],
    );
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer test-token",
    );
    expect(JSON.parse(fetcher.mock.calls[1][1].body).id).toBeUndefined();
  });
  it("preserves a cannot_answer response instead of inventing an answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              result: {
                structuredContent: {
                  status: "cannot_answer",
                  candidates: ["one_day", "seven_day"],
                },
              },
            }),
          ),
        ),
    );
    const result = await new McpClient("/analytics", "test").ask(
      "resolution rate",
    );
    expect(result.status).toBe("cannot_answer");
    expect(result.candidates).toEqual(["one_day", "seven_day"]);
  });
  it("uses REST for saved reruns and safely encodes IDs", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ status: "answered", provenance: { llm_calls: 0 } }),
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(
      (await new McpClient("/analytics", "test").run("qry/a")).provenance
        .llm_calls,
    ).toBe(0);
    expect(fetcher.mock.calls[0][0]).toBe(
      "/analytics/api/v1/saved-queries/qry%2Fa/run",
    );
  });
  it("surfaces authorization failures and missing required tools", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ message: "A valid bearer token is required." }),
            { status: 401 },
          ),
        ),
    );
    await expect(new McpClient("/analytics", "bad").connect()).rejects.toThrow(
      "valid bearer token",
    );
  });
});
describe("result formatting", () => {
  it("formats percent fractions and nulls without changing high-precision decimals", () => {
    expect(
      displayValue(0.25, {
        name: "rate",
        role: "metric",
        type: "decimal",
        unit: "percent",
      }),
    ).toBe("25%");
    expect(displayValue(null)).toBe("—");
    expect(displayValue("12345678901234567890.123456")).toBe(
      "12345678901234567890.123456",
    );
  });
});
