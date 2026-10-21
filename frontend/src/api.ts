export type Column = {
  name: string;
  role: string;
  type: string;
  unit?: string | null;
  additivity?: string;
};
export type Answer = {
  status: "answered" | "cannot_answer" | "error";
  request_id?: string;
  resolution_id?: string | null;
  interpretation?: string;
  columns: Column[];
  rows: unknown[][];
  truncated: boolean;
  provenance: Record<string, any>;
  message?: string;
  reason_code?: string;
  candidates?: string[];
};
export type RuntimeConfig = {
  prefix: string;
  questions: string[];
  resolver_mode: string;
  execution_mode: string;
  model: string;
};
export class McpClient {
  private id = 0;
  constructor(
    readonly prefix: string,
    private token: string,
  ) {}
  private async request(path: string, body?: unknown, method = "POST") {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 180000);
    try {
      const response = await fetch(path, {
        method,
        signal: abort.signal,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const raw = await response.text();
      let value;
      try {
        value = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(
          `Unexpected server response (${response.status}). This client requires the JSON Streamable HTTP transport.`,
        );
      }
      if (!response.ok)
        throw new Error(
          value.message || value.detail || `HTTP ${response.status}`,
        );
      return value;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError")
        throw new Error(
          "The request timed out. Check the backend before retrying; it may still be running.",
        );
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  async rpc(method: string, params: unknown = {}, notification = false) {
    const body = {
      jsonrpc: "2.0",
      method,
      params,
      ...(notification ? {} : { id: ++this.id }),
    };
    const result = await this.request(this.prefix + "/mcp", body);
    if (result.error)
      throw new Error(result.error.message || "MCP request failed");
    return result.result;
  }
  async connect() {
    await this.rpc("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "cx-react-workspace", version: "0.1.0" },
    });
    await this.rpc("notifications/initialized", {}, true);
    const result = await this.rpc("tools/list");
    const names = result.tools.map((tool: { name: string }) => tool.name);
    if (!names.includes("ask_question") || !names.includes("save_query"))
      throw new Error("Required analytical tools were not discovered.");
    return names as string[];
  }
  async tool(name: string, args: unknown) {
    const result = await this.rpc("tools/call", { name, arguments: args });
    if (result.isError)
      throw new Error(
        result.content
          ?.map((item: { text?: string }) => item.text || "")
          .join("\n") || "Tool failed",
      );
    if (!result.structuredContent)
      throw new Error("The tool did not return a structured answer.");
    return result.structuredContent;
  }
  ask(question: string): Promise<Answer> {
    return this.tool("ask_question", { question });
  }
  save(
    resolution_id: string,
    name: string,
  ): Promise<{ status: string; saved_query_id?: string; message?: string }> {
    return this.tool("save_query", { resolution_id, name });
  }
  run(id: string): Promise<Answer> {
    return this.request(
      `${this.prefix}/api/v1/saved-queries/${encodeURIComponent(id)}/run`,
      {},
    );
  }
  getSaved(id: string) {
    return this.request(
      `${this.prefix}/api/v1/saved-queries/${encodeURIComponent(id)}`,
      undefined,
      "GET",
    );
  }
}
export function displayValue(value: unknown, column?: Column) {
  if (value === null || value === undefined) return "—";
  if (column?.unit === "percent" && Number.isFinite(Number(value)))
    return new Intl.NumberFormat("en", {
      style: "percent",
      maximumFractionDigits: 2,
    }).format(Number(value));
  // Keep driver decimal strings intact; conversion could lose precision.
  if (typeof value === "number")
    return new Intl.NumberFormat("en", { maximumFractionDigits: 6 }).format(
      value,
    );
  return String(value);
}
