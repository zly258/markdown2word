// 文档类型枚举
export enum DocType {
  MARKDOWN = 'markdown',
  DOCX = 'docx',
  PPTX = 'pptx',
  XLSX = 'xlsx'
}

// 解析后的表格接口
export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

// 内容类型枚举
export enum ContentType {
  PARAGRAPH = 'paragraph',
  CODE_BLOCK = 'code_block',
  TABLE = 'table',
  LIST_ITEM = 'list_item',
  BLOCKQUOTE = 'blockquote', // 引用块支持
  HR = 'hr' // 水平线支持
}

// 内容块接口
export interface ContentBlock {
  type: ContentType;
  content: string; // 原始文本、代码或表格行
  language?: string; // 代码块的语言（例如 'mermaid', 'python'）
  tableData?: ParsedTable; // 表格数据
}

// 解析后的章节接口
export interface ParsedSection {
  title: string;
  level: number;
  blocks: ContentBlock[];
}

// 生成状态接口
export interface GenerationState {
  isLoading: boolean;
  error: string | null;
  content: string; // 原始Markdown
}

// 提示模板接口
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  targetType: DocType;
}