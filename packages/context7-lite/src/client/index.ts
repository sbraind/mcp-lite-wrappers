export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface Context7Response<T> {
  data?: T;
  error?: string;
}

interface LibraryMatch {
  id: string;
  name: string;
  description?: string;
  version?: string;
  url?: string;
}

interface LibraryDocs {
  content: string;
  library: {
    id: string;
    name: string;
    version?: string;
  };
  topic?: string;
  tokens_used?: number;
}

export class Context7Client {
  private apiUrl = "https://context7.com/api";
  private headers: Record<string, string>;

  constructor(apiKey?: string) {
    this.headers = {
      "Content-Type": "application/json",
    };

    if (apiKey) {
      this.headers["Authorization"] = `Bearer ${apiKey}`;
    }
  }

  private async request<T>(
    endpoint: string,
    params?: Record<string, string>,
    options?: { responseType?: 'json' | 'text' }
  ): Promise<T> {
    const url = new URL(`${this.apiUrl}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: this.headers,
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new ApiError(
          "Rate limit exceeded. Please add a CONTEXT7_API_KEY environment variable or wait before retrying.",
          response.status,
          "RATE_LIMIT_EXCEEDED"
        );
      }

      const errorText = await response.text();
      throw new ApiError(
        `API request failed: ${errorText}`,
        response.status
      );
    }

    // Handle text responses (like markdown docs)
    if (options?.responseType === 'text') {
      const text = await response.text();
      return text as T;
    }

    const data = await response.json();

    // Check if the response has an error field
    if (data && typeof data === 'object' && 'error' in data) {
      throw new ApiError(
        String(data.error),
        response.status,
        "API_ERROR"
      );
    }

    return data as T;
  }

  async resolveLibraryId(libraryName: string, query?: string): Promise<LibraryMatch[]> {
    // The Context7 API endpoint for resolving library IDs
    // Based on the MCP implementation, this searches for libraries
    // The query parameter helps rank results by relevance to user's task
    const params: Record<string, string> = { q: libraryName };

    if (query) {
      params.query = query;
    }

    const response = await this.request<{ results: LibraryMatch[] }>(
      "/v2/search",
      params
    );

    return response.results || [];
  }

  async getLibraryDocs(
    context7CompatibleLibraryID: string,
    options?: {
      topic?: string;
      tokens?: number;
    }
  ): Promise<LibraryDocs> {
    // Remove leading slash if present for the API call
    const libraryPath = context7CompatibleLibraryID.startsWith("/")
      ? context7CompatibleLibraryID.slice(1)
      : context7CompatibleLibraryID;

    const params: Record<string, string> = {};

    if (options?.topic) {
      params.topic = options.topic;
    }

    if (options?.tokens) {
      params.tokens = String(options.tokens);
    }

    // The API returns markdown text, not JSON
    const content = await this.request<string>(
      `/v2/docs/code/${libraryPath}`,
      params,
      { responseType: 'text' }
    );

    return {
      content,
      library: {
        id: context7CompatibleLibraryID,
        name: libraryPath.split('/').pop() || libraryPath,
      },
      topic: options?.topic,
    };
  }
}
