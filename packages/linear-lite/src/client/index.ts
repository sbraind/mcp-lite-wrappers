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

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

export class LinearClient {
  private apiUrl = "https://api.linear.app/graphql";
  private headers: Record<string, string>;

  constructor(apiKey: string) {
    this.headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
  }

  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ query, variables }),
    });

    const json = (await response.json()) as GraphQLResponse<T>;

    if (json.errors && json.errors.length > 0) {
      const error = json.errors[0];
      throw new ApiError(
        error.message,
        response.status,
        error.extensions?.code
      );
    }

    if (!json.data) {
      throw new ApiError("No data returned from API", response.status);
    }

    return json.data;
  }

  // ==================== Issues ====================

  async createIssue(input: {
    title: string;
    teamId: string;
    description?: string;
    priority?: number;
    stateId?: string;
    assigneeId?: string;
    labelIds?: string[];
    projectId?: string;
    dueDate?: string;
    estimate?: number;
    parentId?: string;
  }): Promise<unknown> {
    const query = `
      mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            title
            url
            state { id name }
            team { id key name }
            assignee { id name }
            priority
            createdAt
          }
        }
      }
    `;
    return this.graphql(query, { input });
  }

  async updateIssue(
    issueId: string,
    input: {
      title?: string;
      description?: string;
      stateId?: string;
      teamId?: string;
      assigneeId?: string;
      priority?: number;
      dueDate?: string;
      labelIds?: string[];
      projectId?: string;
      estimate?: number;
    }
  ): Promise<unknown> {
    const query = `
      mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue {
            id
            identifier
            title
            url
            state { id name }
            team { id key name }
            assignee { id name }
            priority
            updatedAt
          }
        }
      }
    `;
    return this.graphql(query, { id: issueId, input });
  }

  async getIssue(issueId: string): Promise<unknown> {
    const query = `
      query Issue($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
          description
          url
          priority
          estimate
          dueDate
          createdAt
          updatedAt
          state { id name color }
          team { id key name }
          assignee { id name email }
          creator { id name }
          project { id name }
          labels { nodes { id name color } }
          parent { id identifier title }
          children { nodes { id identifier title } }
        }
      }
    `;
    return this.graphql(query, { id: issueId });
  }

  async searchIssues(
    query: string,
    options?: { includeArchived?: boolean; limit?: number }
  ): Promise<unknown> {
    const gql = `
      query SearchIssues($query: String!, $first: Int, $includeArchived: Boolean) {
        searchIssues(query: $query, first: $first, includeArchived: $includeArchived) {
          nodes {
            id
            identifier
            title
            description
            url
            priority
            state { id name }
            team { id key name }
            assignee { id name }
            createdAt
            updatedAt
          }
        }
      }
    `;
    return this.graphql(gql, {
      query,
      first: options?.limit || 10,
      includeArchived: options?.includeArchived || false,
    });
  }

  async getUserIssues(options?: {
    userId?: string;
    includeArchived?: boolean;
    limit?: number;
  }): Promise<unknown> {
    // If no userId provided, get the viewer's issues
    if (!options?.userId) {
      const query = `
        query ViewerIssues($first: Int, $includeArchived: Boolean) {
          viewer {
            assignedIssues(first: $first, includeArchived: $includeArchived) {
              nodes {
                id
                identifier
                title
                url
                priority
                state { id name }
                team { id key name }
                createdAt
              }
            }
          }
        }
      `;
      return this.graphql(query, {
        first: options?.limit || 50,
        includeArchived: options?.includeArchived || false,
      });
    }

    const query = `
      query UserIssues($id: String!, $first: Int, $includeArchived: Boolean) {
        user(id: $id) {
          assignedIssues(first: $first, includeArchived: $includeArchived) {
            nodes {
              id
              identifier
              title
              url
              priority
              state { id name }
              team { id key name }
              createdAt
            }
          }
        }
      }
    `;
    return this.graphql(query, {
      id: options.userId,
      first: options?.limit || 50,
      includeArchived: options?.includeArchived || false,
    });
  }

  async getTeamIssues(
    teamId: string,
    options?: { includeArchived?: boolean; limit?: number }
  ): Promise<unknown> {
    const query = `
      query TeamIssues($id: String!, $first: Int, $includeArchived: Boolean) {
        team(id: $id) {
          issues(first: $first, includeArchived: $includeArchived) {
            nodes {
              id
              identifier
              title
              url
              priority
              state { id name }
              assignee { id name }
              createdAt
            }
          }
        }
      }
    `;
    return this.graphql(query, {
      id: teamId,
      first: options?.limit || 50,
      includeArchived: options?.includeArchived || false,
    });
  }

  async getProjectIssues(
    projectId: string,
    options?: { includeArchived?: boolean; limit?: number }
  ): Promise<unknown> {
    const query = `
      query ProjectIssues($id: String!, $first: Int, $includeArchived: Boolean) {
        project(id: $id) {
          issues(first: $first, includeArchived: $includeArchived) {
            nodes {
              id
              identifier
              title
              url
              priority
              state { id name }
              team { id key name }
              assignee { id name }
              createdAt
            }
          }
        }
      }
    `;
    return this.graphql(query, {
      id: projectId,
      first: options?.limit || 50,
      includeArchived: options?.includeArchived || false,
    });
  }

  // ==================== Comments ====================

  async addComment(input: {
    issueId: string;
    body: string;
    createAsUser?: string;
    displayIconUrl?: string;
  }): Promise<unknown> {
    const query = `
      mutation CommentCreate($input: CommentCreateInput!) {
        commentCreate(input: $input) {
          success
          comment {
            id
            body
            createdAt
            user { id name }
          }
        }
      }
    `;
    return this.graphql(query, { input });
  }

  async getComments(
    issueId: string,
    options?: { limit?: number }
  ): Promise<unknown> {
    const query = `
      query IssueComments($id: String!, $first: Int) {
        issue(id: $id) {
          comments(first: $first) {
            nodes {
              id
              body
              createdAt
              updatedAt
              user { id name email }
            }
          }
        }
      }
    `;
    return this.graphql(query, {
      id: issueId,
      first: options?.limit || 50,
    });
  }

  // ==================== Teams ====================

  async getTeams(options?: {
    includeArchived?: boolean;
    limit?: number;
  }): Promise<unknown> {
    const query = `
      query Teams($first: Int, $includeArchived: Boolean) {
        teams(first: $first, includeArchived: $includeArchived) {
          nodes {
            id
            key
            name
            description
            private
            timezone
            createdAt
          }
        }
      }
    `;
    return this.graphql(query, {
      first: options?.limit || 50,
      includeArchived: options?.includeArchived || false,
    });
  }

  async getTeam(teamId: string): Promise<unknown> {
    const query = `
      query Team($id: String!) {
        team(id: $id) {
          id
          key
          name
          description
          private
          timezone
          createdAt
          states { nodes { id name color position type } }
          labels { nodes { id name color } }
        }
      }
    `;
    return this.graphql(query, { id: teamId });
  }

  // ==================== Projects ====================

  async getProjects(options?: {
    teamId?: string;
    includeArchived?: boolean;
    limit?: number;
  }): Promise<unknown> {
    if (options?.teamId) {
      const query = `
        query TeamProjects($id: String!, $first: Int, $includeArchived: Boolean) {
          team(id: $id) {
            projects(first: $first, includeArchived: $includeArchived) {
              nodes {
                id
                name
                description
                url
                state
                progress
                startDate
                targetDate
                createdAt
                teams { nodes { id key name } }
                lead { id name }
              }
            }
          }
        }
      `;
      return this.graphql(query, {
        id: options.teamId,
        first: options?.limit || 50,
        includeArchived: options?.includeArchived || false,
      });
    }

    const query = `
      query Projects($first: Int, $includeArchived: Boolean) {
        projects(first: $first, includeArchived: $includeArchived) {
          nodes {
            id
            name
            description
            url
            state
            progress
            startDate
            targetDate
            createdAt
            teams { nodes { id key name } }
            lead { id name }
          }
        }
      }
    `;
    return this.graphql(query, {
      first: options?.limit || 50,
      includeArchived: options?.includeArchived || false,
    });
  }

  async getProject(projectId: string): Promise<unknown> {
    const query = `
      query Project($id: String!) {
        project(id: $id) {
          id
          name
          description
          url
          state
          progress
          startDate
          targetDate
          createdAt
          teams { nodes { id key name } }
          lead { id name email }
          members { nodes { id name } }
        }
      }
    `;
    return this.graphql(query, { id: projectId });
  }

  // ==================== Labels ====================

  async getLabels(options?: {
    teamId?: string;
    includeArchived?: boolean;
    limit?: number;
  }): Promise<unknown> {
    if (options?.teamId) {
      const query = `
        query TeamLabels($id: String!, $first: Int, $includeArchived: Boolean) {
          team(id: $id) {
            labels(first: $first, includeArchived: $includeArchived) {
              nodes {
                id
                name
                color
                description
                parent { id name }
              }
            }
          }
        }
      `;
      return this.graphql(query, {
        id: options.teamId,
        first: options?.limit || 50,
        includeArchived: options?.includeArchived || false,
      });
    }

    const query = `
      query Labels($first: Int, $includeArchived: Boolean) {
        issueLabels(first: $first, includeArchived: $includeArchived) {
          nodes {
            id
            name
            color
            description
            team { id key name }
            parent { id name }
          }
        }
      }
    `;
    return this.graphql(query, {
      first: options?.limit || 50,
      includeArchived: options?.includeArchived || false,
    });
  }

  async createLabel(input: {
    teamId: string;
    name: string;
    color?: string;
    description?: string;
    parentId?: string;
  }): Promise<unknown> {
    const query = `
      mutation IssueLabelCreate($input: IssueLabelCreateInput!) {
        issueLabelCreate(input: $input) {
          success
          issueLabel {
            id
            name
            color
            description
          }
        }
      }
    `;
    return this.graphql(query, { input });
  }

  async updateLabel(
    labelId: string,
    input: {
      name?: string;
      color?: string;
      description?: string;
    }
  ): Promise<unknown> {
    const query = `
      mutation IssueLabelUpdate($id: String!, $input: IssueLabelUpdateInput!) {
        issueLabelUpdate(id: $id, input: $input) {
          success
          issueLabel {
            id
            name
            color
            description
          }
        }
      }
    `;
    return this.graphql(query, { id: labelId, input });
  }

  // ==================== Users ====================

  async getViewer(): Promise<unknown> {
    const query = `
      query Viewer {
        viewer {
          id
          name
          email
          displayName
          avatarUrl
          admin
          active
          createdAt
        }
      }
    `;
    return this.graphql(query);
  }

  async getUsers(options?: {
    includeArchived?: boolean;
    limit?: number;
  }): Promise<unknown> {
    const query = `
      query Users($first: Int, $includeArchived: Boolean) {
        users(first: $first, includeArchived: $includeArchived) {
          nodes {
            id
            name
            email
            displayName
            avatarUrl
            admin
            active
          }
        }
      }
    `;
    return this.graphql(query, {
      first: options?.limit || 50,
      includeArchived: options?.includeArchived || false,
    });
  }

  // ==================== Issue Relations ====================

  async linkIssues(input: {
    issueId: string;
    relatedIssueId: string;
    type: string;
  }): Promise<unknown> {
    const query = `
      mutation IssueRelationCreate($input: IssueRelationCreateInput!) {
        issueRelationCreate(input: $input) {
          success
          issueRelation {
            id
            type
            issue { id identifier title }
            relatedIssue { id identifier title }
          }
        }
      }
    `;
    return this.graphql(query, { input });
  }

  async getIssueRelations(issueId: string): Promise<unknown> {
    const query = `
      query IssueRelations($id: String!) {
        issue(id: $id) {
          relations {
            nodes {
              id
              type
              relatedIssue { id identifier title url state { name } }
            }
          }
          inverseRelations {
            nodes {
              id
              type
              issue { id identifier title url state { name } }
            }
          }
        }
      }
    `;
    return this.graphql(query, { id: issueId });
  }

  // ==================== Attachments ====================

  async addAttachment(input: {
    issueId: string;
    url: string;
    title?: string;
    subtitle?: string;
    iconUrl?: string;
  }): Promise<unknown> {
    const query = `
      mutation AttachmentCreate($input: AttachmentCreateInput!) {
        attachmentCreate(input: $input) {
          success
          attachment {
            id
            url
            title
            subtitle
            createdAt
          }
        }
      }
    `;
    return this.graphql(query, { input });
  }

  async getAttachments(issueId: string): Promise<unknown> {
    const query = `
      query IssueAttachments($id: String!) {
        issue(id: $id) {
          attachments {
            nodes {
              id
              url
              title
              subtitle
              createdAt
              creator { id name }
            }
          }
        }
      }
    `;
    return this.graphql(query, { id: issueId });
  }

  // ==================== Workflow States ====================

  async getWorkflowStates(
    teamId: string,
    options?: { includeArchived?: boolean }
  ): Promise<unknown> {
    const query = `
      query TeamStates($id: String!, $includeArchived: Boolean) {
        team(id: $id) {
          states(includeArchived: $includeArchived) {
            nodes {
              id
              name
              color
              position
              type
              description
            }
          }
        }
      }
    `;
    return this.graphql(query, {
      id: teamId,
      includeArchived: options?.includeArchived || false,
    });
  }
}
