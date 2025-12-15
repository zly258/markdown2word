export enum DocType {
  MARKDOWN = 'markdown',
  DOCX = 'docx',
  PPTX = 'pptx',
  XLSX = 'xlsx'
}

export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

export enum ContentType {
  PARAGRAPH = 'paragraph',
  CODE_BLOCK = 'code_block',
  TABLE = 'table',
  LIST_ITEM = 'list_item'
}

export interface ContentBlock {
  type: ContentType;
  content: string; // The raw text, code, or table row
  language?: string; // For code blocks (e.g., 'mermaid', 'python')
  tableData?: ParsedTable; // For tables
}

export interface ParsedSection {
  title: string;
  level: number;
  blocks: ContentBlock[];
}

export interface GenerationState {
  isLoading: boolean;
  error: string | null;
  content: string; // Raw Markdown
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  targetType: DocType;
}