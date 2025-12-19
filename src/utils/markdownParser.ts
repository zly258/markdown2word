import { ParsedSection, ParsedTable, ContentBlock, ContentType } from '../types';

/**
 * 强大的Markdown解析器，用于提取包括代码块、表格和数学块在内的结构。
 */
export const parseMarkdownToSections = (markdown: string): ParsedSection[] => {
  const lines = markdown.split('\n');
  const sections: ParsedSection[] = [];
  
  let currentSection: ParsedSection = {
    title: '简介',
    level: 1,
    blocks: []
  };

  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeLanguage = '';

  let inMathBlock = false;
  let mathBlockContent: string[] = [];

  let inTable = false;
  let tableRows: string[] = [];

  let inBlockquote = false;
  let blockquoteContent: string[] = [];

  // 刷新代码块
  const flushCodeBlock = () => {
    if (codeBlockContent.length > 0) {
      currentSection.blocks.push({
        type: ContentType.CODE_BLOCK,
        content: codeBlockContent.join('\n'),
        language: codeLanguage.trim()
      });
      codeBlockContent = [];
      codeLanguage = '';
    }
  };

  // 刷新数学块
  const flushMathBlock = () => {
    if (mathBlockContent.length > 0) {
      // 创建一个语言为'math'的代码块，exportService会将其作为块级方程处理
      currentSection.blocks.push({
        type: ContentType.CODE_BLOCK,
        content: mathBlockContent.join('\n'),
        language: 'math'
      });
      mathBlockContent = [];
    }
  };

  // 刷新表格
  const flushTable = () => {
    if (tableRows.length > 0) {
      const parsed = parseTable(tableRows);
      if (parsed) {
        currentSection.blocks.push({
          type: ContentType.TABLE,
          content: '',
          tableData: parsed
        });
      }
      tableRows = [];
    }
  };

  // 刷新引用块
  const flushBlockquote = () => {
    if (blockquoteContent.length > 0) {
      currentSection.blocks.push({
        type: ContentType.BLOCKQUOTE,
        content: blockquoteContent.join('\n')
      });
      blockquoteContent = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 0. 数学块 ($$)
    if (trimmedLine === '$$') {
        if (inMathBlock) {
            // 数学块结束
            inMathBlock = false;
            flushMathBlock();
        } else {
            // 数学块开始
            if (inCodeBlock) {
                 // 如果嵌套则不应该发生，但作为内容处理
                 codeBlockContent.push(line);
                 continue;
            }
            if (inTable) { inTable = false; flushTable(); }
            if (inBlockquote) { inBlockquote = false; flushBlockquote(); }
            
            inMathBlock = true;
        }
        continue;
    }

    if (inMathBlock) {
        mathBlockContent.push(line);
        continue;
    }

    // 1. 代码块 (```)
    if (trimmedLine.startsWith('```')) {
      if (inCodeBlock) {
        // 代码块结束
        inCodeBlock = false;
        flushCodeBlock();
      } else {
        // 代码块开始
        if (inTable) { inTable = false; flushTable(); }
        if (inBlockquote) { inBlockquote = false; flushBlockquote(); }
        
        inCodeBlock = true;
        codeLanguage = trimmedLine.replace(/```/g, '');
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // 2. 标题 (#, ##)
    if (trimmedLine.startsWith('#')) {
      if (inTable) { inTable = false; flushTable(); }
      if (inBlockquote) { inBlockquote = false; flushBlockquote(); }
      
      // 如果有内容则保存前一节
      if (currentSection.blocks.length > 0) {
        sections.push({ ...currentSection });
      }

      // 开始新节
      const level = trimmedLine.match(/^#+/)?.[0].length || 1;
      const title = trimmedLine.replace(/^#+\s*/, '');
      
      currentSection = {
        title,
        level,
        blocks: []
      };
      continue;
    }

    // 3. 表格
    if (trimmedLine.includes('|')) {
      if (!inTable) {
        // 检查分隔符 |---|
        const nextLine = lines[i + 1]?.trim();
        if (nextLine && nextLine.includes('|') && nextLine.includes('-')) {
             inTable = true;
             tableRows = [];
             if (inBlockquote) { inBlockquote = false; flushBlockquote(); }
        } else {
             // 不是表格，只是文本
             if (trimmedLine.length > 0) {
                 currentSection.blocks.push({ type: ContentType.PARAGRAPH, content: trimmedLine });
             }
             continue;
        }
      }
      
      if (inTable) {
        tableRows.push(trimmedLine);
        // 检查表格是否结束
        const nextLine = lines[i + 1]?.trim();
        if (!nextLine || !nextLine.includes('|')) {
          inTable = false;
          flushTable();
        }
        continue;
      }
    }

    // 4. 引用块 (>)
    if (trimmedLine.startsWith('>')) {
      if (inTable) { inTable = false; flushTable(); }
      
      // 如果不在引用块中，则开始新的引用块
      if (!inBlockquote) {
        inBlockquote = true;
        blockquoteContent = [];
      }
      
      // 移除>符号和可能的空格
      const content = trimmedLine.replace(/^>\s?/, '');
      blockquoteContent.push(content);
      continue;
    }
    
    // 如果之前在引用块中，但现在不是以>开头，则结束引用块
    if (inBlockquote && !trimmedLine.startsWith('>')) {
      inBlockquote = false;
      flushBlockquote();
    }

    // 5. 列表项
    if (trimmedLine.match(/^[-*]\s/) || trimmedLine.match(/^\d+\.\s/)) {
      if (inTable) { inTable = false; flushTable(); }
      if (inBlockquote) { inBlockquote = false; flushBlockquote(); }
      currentSection.blocks.push({
        type: ContentType.LIST_ITEM,
        content: trimmedLine.replace(/^([-*]|\d+\.)\s/, '')
      });
      continue;
    }

    // 6. 水平线
    if (trimmedLine === '---' || trimmedLine === '***' || trimmedLine === '___') {
      if (inTable) { inTable = false; flushTable(); }
      if (inBlockquote) { inBlockquote = false; flushBlockquote(); }
      currentSection.blocks.push({
        type: ContentType.HR,
        content: ''
      });
      continue;
    }

    // 7. 普通文本
    if (trimmedLine.length > 0) {
      if (inTable) { inTable = false; flushTable(); }
      if (inBlockquote) { inBlockquote = false; flushBlockquote(); }
      currentSection.blocks.push({
        type: ContentType.PARAGRAPH,
        content: trimmedLine
      });
    }

  }

  // 刷新剩余内容
  if (inTable) flushTable();
  if (inCodeBlock) flushCodeBlock();
  if (inMathBlock) flushMathBlock();
  if (inBlockquote) flushBlockquote();
  
  if (currentSection.blocks.length > 0) {
    sections.push(currentSection);
  }

  return sections;
};

// 解析表格
const parseTable = (rows: string[]): ParsedTable | undefined => {
  if (rows.length < 2) return undefined;

  const contentRows = rows.filter(row => {
      const clean = row.replace(/\|/g, '').trim();
      return !clean.match(/^[- :]+$/); // 过滤分隔符行
  });
  
  if (contentRows.length === 0) return undefined;

  const extractCells = (row: string) => {
    const trimmed = row.trim();
    const parts = trimmed.split('|');
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
       return parts.slice(1, -1).map(c => c.trim());
    }
    return parts.map(c => c.trim());
  };

  const headers = extractCells(contentRows[0]);
  const data = contentRows.slice(1).map(extractCells);

  return { headers, rows: data };
};