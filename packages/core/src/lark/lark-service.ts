const DEFAULT_BASE_URL = "https://open.feishu.cn/open-apis";

interface LarkApiResponse {
  code: number;
  msg: string;
  data?: any;
  tenant_access_token?: string;
  expire?: number;
}

export interface LarkDocBlock {
  block_type: number;
  text?: {
    elements: Array<{
      text_run?: { content: string; text_element_style?: Record<string, unknown> };
    }>;
  };
}

export interface LarkWikiNode {
  space_id: string;
  node_token: string;
  obj_token: string;
  obj_type: string;
  parent_node_token: string;
  node_type: string;
  origin_node_token: string;
  origin_space_id: string;
  has_child: boolean;
  title: string;
  obj_create_time: string;
  obj_edit_time: string;
  node_create_time: string;
  creator: string;
  owner: string;
}

export class LarkService {
  private appId: string;
  private appSecret: string;
  private baseUrl: string;
  private tenantToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(appId: string, appSecret: string, baseUrl?: string) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
  }

  private async ensureToken(): Promise<string> {
    if (this.tenantToken && Date.now() < this.tokenExpiresAt) {
      return this.tenantToken;
    }

    const resp = await fetch(
      `${this.baseUrl}/auth/v3/tenant_access_token/internal`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          app_id: this.appId,
          app_secret: this.appSecret,
        }),
      },
    );
    const data: LarkApiResponse = await resp.json();
    if (data.code !== 0 || !data.tenant_access_token) {
      throw new Error(`Lark auth failed: ${data.msg} (code ${data.code})`);
    }

    this.tenantToken = data.tenant_access_token;
    this.tokenExpiresAt = Date.now() + ((data.expire ?? 7200) - 300) * 1000;
    return this.tenantToken;
  }

  private async request<T = any>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string>,
  ): Promise<T> {
    const token = await this.ensureToken();
    let url = `${this.baseUrl}${path}`;
    if (query) {
      const qs = new URLSearchParams(query).toString();
      url += (url.includes("?") ? "&" : "?") + qs;
    }

    const resp = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data: LarkApiResponse = await resp.json();
    if (data.code !== 0) {
      throw new Error(
        `Lark API error [${method} ${path}]: ${data.msg} (code ${data.code})`,
      );
    }
    return data.data as T;
  }

  // ─── Document Operations ───────────────────────────────────────────────────

  async readDocument(documentId: string): Promise<{ content: string }> {
    const data = await this.request<{ content: string }>(
      "GET",
      `/docx/v1/documents/${documentId}/raw_content`,
    );
    return { content: data.content };
  }

  async getDocumentMeta(documentId: string): Promise<{
    document_id: string;
    revision_id: number;
    title: string;
  }> {
    const data = await this.request<{ document: any }>(
      "GET",
      `/docx/v1/documents/${documentId}`,
    );
    return data.document;
  }

  async createDocument(params: {
    title: string;
    folderToken?: string;
  }): Promise<{ document_id: string; revision_id: number; title: string }> {
    const body: Record<string, unknown> = { title: params.title };
    if (params.folderToken) body.folder_token = params.folderToken;
    const data = await this.request<{ document: any }>(
      "POST",
      "/docx/v1/documents",
      body,
    );
    return data.document;
  }

  async appendDocumentBlocks(
    documentId: string,
    blocks: LarkDocBlock[],
    index?: number,
  ): Promise<any> {
    const body: Record<string, unknown> = { children: blocks };
    if (index !== undefined) body.index = index;
    return this.request(
      "POST",
      `/docx/v1/documents/${documentId}/blocks/${documentId}/children`,
      body,
    );
  }

  /**
   * High-level helper: create a document and populate it with text content.
   * Content lines starting with `# `, `## `, `### ` are turned into heading blocks.
   */
  async createDocumentWithContent(params: {
    title: string;
    content: string;
    folderToken?: string;
  }): Promise<{ document_id: string; title: string }> {
    const doc = await this.createDocument({
      title: params.title,
      folderToken: params.folderToken,
    });

    if (params.content.trim()) {
      const blocks = this.markdownToBlocks(params.content);
      if (blocks.length > 0) {
        await this.appendDocumentBlocks(doc.document_id, blocks);
      }
    }

    return { document_id: doc.document_id, title: doc.title };
  }

  // ─── Wiki Operations ───────────────────────────────────────────────────────

  async getWikiNode(
    token: string,
    objType?: string,
  ): Promise<{ node: LarkWikiNode }> {
    const query: Record<string, string> = { token };
    if (objType) query.obj_type = objType;
    return this.request("GET", "/wiki/v2/spaces/get_node", undefined, query);
  }

  async searchWiki(params: {
    query: string;
    spaceId?: string;
    nodeId?: string;
    pageSize?: number;
    pageToken?: string;
  }): Promise<{
    items: any[];
    page_token?: string;
    has_more: boolean;
  }> {
    const body: Record<string, unknown> = { query: params.query };
    if (params.spaceId) body.space_id = params.spaceId;
    if (params.nodeId) body.node_id = params.nodeId;

    const query: Record<string, string> = {};
    if (params.pageSize) query.page_size = String(params.pageSize);
    if (params.pageToken) query.page_token = params.pageToken;

    return this.request("POST", "/wiki/v1/nodes/search", body, query);
  }

  async createWikiNode(params: {
    spaceId: string;
    parentNodeToken?: string;
    objType?: string;
    title?: string;
  }): Promise<{ node: LarkWikiNode }> {
    const body: Record<string, unknown> = {
      obj_type: params.objType || "docx",
    };
    if (params.parentNodeToken)
      body.parent_node_token = params.parentNodeToken;
    if (params.title) body.title = params.title;
    return this.request(
      "POST",
      `/wiki/v2/spaces/${params.spaceId}/nodes`,
      body,
    );
  }

  /**
   * Read the content of a wiki page by its node token.
   * Resolves the underlying document and reads its raw content.
   */
  async readWikiContent(nodeToken: string): Promise<{
    content: string;
    node: LarkWikiNode;
  }> {
    const { node } = await this.getWikiNode(nodeToken);
    const { content } = await this.readDocument(node.obj_token);
    return { content, node };
  }

  /**
   * Create a wiki page and populate it with content.
   */
  async createWikiNodeWithContent(params: {
    spaceId: string;
    parentNodeToken?: string;
    title: string;
    content: string;
  }): Promise<{ node: LarkWikiNode }> {
    const result = await this.createWikiNode({
      spaceId: params.spaceId,
      parentNodeToken: params.parentNodeToken,
      title: params.title,
      objType: "docx",
    });

    if (params.content.trim()) {
      const blocks = this.markdownToBlocks(params.content);
      if (blocks.length > 0) {
        await this.appendDocumentBlocks(result.node.obj_token, blocks);
      }
    }

    return result;
  }

  // ─── URL Parsing ───────────────────────────────────────────────────────────

  /**
   * Extract document or wiki token from a Lark/Feishu URL.
   */
  static parseUrl(
    url: string,
  ): { type: "docx" | "wiki" | "sheet" | "bitable"; token: string } | null {
    try {
      const u = new URL(url);
      if (
        !u.hostname.includes("feishu.cn") &&
        !u.hostname.includes("larksuite.com")
      )
        return null;

      const path = u.pathname;

      const docxMatch = path.match(/\/docx\/([A-Za-z0-9]+)/);
      if (docxMatch) return { type: "docx", token: docxMatch[1] };

      const wikiMatch = path.match(/\/wiki\/([A-Za-z0-9]+)/);
      if (wikiMatch) return { type: "wiki", token: wikiMatch[1] };

      const sheetMatch = path.match(/\/sheets\/([A-Za-z0-9]+)/);
      if (sheetMatch) return { type: "sheet", token: sheetMatch[1] };

      const bitableMatch = path.match(/\/base\/([A-Za-z0-9]+)/);
      if (bitableMatch) return { type: "bitable", token: bitableMatch[1] };

      return null;
    } catch {
      return null;
    }
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Convert simple markdown text to Lark document blocks.
   * Supports headings (# ## ###) and plain text paragraphs.
   */
  private markdownToBlocks(markdown: string): LarkDocBlock[] {
    const lines = markdown.split("\n");
    const blocks: LarkDocBlock[] = [];
    let currentParagraph: string[] = [];

    const flushParagraph = () => {
      if (currentParagraph.length === 0) return;
      const text = currentParagraph.join("\n").trim();
      if (text) {
        blocks.push({
          block_type: 2,
          text: { elements: [{ text_run: { content: text } }] },
        });
      }
      currentParagraph = [];
    };

    for (const line of lines) {
      const h1 = line.match(/^# (.+)$/);
      if (h1) {
        flushParagraph();
        blocks.push({
          block_type: 3,
          text: { elements: [{ text_run: { content: h1[1] } }] },
        });
        continue;
      }

      const h2 = line.match(/^## (.+)$/);
      if (h2) {
        flushParagraph();
        blocks.push({
          block_type: 4,
          text: { elements: [{ text_run: { content: h2[1] } }] },
        });
        continue;
      }

      const h3 = line.match(/^### (.+)$/);
      if (h3) {
        flushParagraph();
        blocks.push({
          block_type: 5,
          text: { elements: [{ text_run: { content: h3[1] } }] },
        });
        continue;
      }

      if (line.trim() === "") {
        flushParagraph();
      } else {
        currentParagraph.push(line);
      }
    }

    flushParagraph();
    return blocks;
  }
}
