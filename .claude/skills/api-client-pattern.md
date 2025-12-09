---
name: api-client-pattern
description: Use when implementing API clients for Supabase, Linear, or other services. Ensures consistent HTTP handling, auth, and error management.
---

# API Client Pattern

## When to Use
- Creating HTTP client for external API
- Implementing auth handling
- Standardizing error responses

## Client Structure

### 1. Base Client Class
```typescript
// src/client/base.ts
export abstract class BaseClient {
  protected baseUrl: string;
  protected headers: Record<string, string>;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl;
    this.headers = {
      "Content-Type": "application/json",
      ...config.headers
    };
  }

  protected async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      throw await this.handleError(response);
    }

    return response.json();
  }

  protected abstract handleError(response: Response): Promise<Error>;
}
```

### 2. Service-Specific Client
```typescript
// src/client/supabase.ts
export class SupabaseClient extends BaseClient {
  constructor(accessToken: string, projectRef?: string) {
    super({
      baseUrl: projectRef
        ? `https://${projectRef}.supabase.co`
        : "https://api.supabase.com",
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
  }

  async executeSql(query: string): Promise<QueryResult> {
    return this.request("POST", "/rest/v1/rpc/query", { query });
  }

  async listTables(schemas: string[]): Promise<Table[]> {
    // Implementation
  }
}
```

### 3. Environment Config
```typescript
// src/config.ts
export function getConfig() {
  return {
    supabaseAccessToken: process.env.SUPABASE_ACCESS_TOKEN,
    supabaseProjectRef: process.env.SUPABASE_PROJECT_REF,
    linearApiKey: process.env.LINEAR_API_KEY
  };
}
```

## Error Handling

```typescript
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }

  toMcpError(): ToolResult {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: true,
          message: this.message,
          code: this.code
        })
      }],
      isError: true
    };
  }
}
```

## Auth Patterns

| Service | Auth Method | Header |
|---------|-------------|--------|
| Supabase Management | Access Token | `Authorization: Bearer <token>` |
| Supabase Project | Anon/Service Key | `apikey: <key>` |
| Linear | API Key | `Authorization: <key>` |
