import { ParsedSection, ParsedTable, ContentBlock, ContentType } from '../types';

/**
 * A robust Markdown parser to extract structure including Code Blocks, Tables, and Math Blocks.
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

  const flushMathBlock = () => {
    if (mathBlockContent.length > 0) {
      // Create a code block with language 'math' which exportService handles as a block equation
      currentSection.blocks.push({
        type: ContentType.CODE_BLOCK,
        content: mathBlockContent.join('\n'),
        language: 'math'
      });
      mathBlockContent = [];
    }
  };

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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 0. Math Blocks ($$)
    if (trimmedLine === '$$') {
        if (inMathBlock) {
            // End of math block
            inMathBlock = false;
            flushMathBlock();
        } else {
            // Start of math block
            if (inCodeBlock) {
                 // Should not happen if nested, but treat as content
                 codeBlockContent.push(line);
                 continue;
            }
            if (inTable) { inTable = false; flushTable(); }
            
            inMathBlock = true;
        }
        continue;
    }

    if (inMathBlock) {
        mathBlockContent.push(line);
        continue;
    }

    // 1. Code Blocks (```)
    if (trimmedLine.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        inCodeBlock = false;
        flushCodeBlock();
      } else {
        // Start of code block
        if (inTable) { inTable = false; flushTable(); }
        
        inCodeBlock = true;
        codeLanguage = trimmedLine.replace(/```/g, '');
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // 2. Headers (#, ##)
    if (trimmedLine.startsWith('#')) {
      if (inTable) { inTable = false; flushTable(); }
      
      // Save previous section if it has content
      if (currentSection.blocks.length > 0) {
        sections.push({ ...currentSection });
      }

      // Start new section
      const level = trimmedLine.match(/^#+/)?.[0].length || 1;
      const title = trimmedLine.replace(/^#+\s*/, '');
      
      currentSection = {
        title,
        level,
        blocks: []
      };
      continue;
    }

    // 3. Tables
    if (trimmedLine.includes('|')) {
      if (!inTable) {
        // Check lookahead for separator |---|
        const nextLine = lines[i + 1]?.trim();
        if (nextLine && nextLine.includes('|') && nextLine.includes('-')) {
             inTable = true;
             tableRows = [];
        } else {
             // Not a table, just text
             if (trimmedLine.length > 0) {
                 currentSection.blocks.push({ type: ContentType.PARAGRAPH, content: trimmedLine });
             }
             continue;
        }
      }
      
      if (inTable) {
        tableRows.push(trimmedLine);
        // Check lookahead if table ends
        const nextLine = lines[i + 1]?.trim();
        if (!nextLine || !nextLine.includes('|')) {
          inTable = false;
          flushTable();
        }
        continue;
      }
    }

    // 4. Bullet Points / Lists
    if (trimmedLine.match(/^[-*]\s/) || trimmedLine.match(/^\d+\.\s/)) {
      if (inTable) { inTable = false; flushTable(); }
      currentSection.blocks.push({
        type: ContentType.LIST_ITEM,
        content: trimmedLine.replace(/^([-*]|\d+\.)\s/, '')
      });
      continue;
    }

    // 5. Normal Text
    if (trimmedLine.length > 0 && !trimmedLine.startsWith('---')) {
      if (inTable) { inTable = false; flushTable(); }
      currentSection.blocks.push({
        type: ContentType.PARAGRAPH,
        content: trimmedLine
      });
    }
  }

  // Flush remaining
  if (inTable) flushTable();
  if (inCodeBlock) flushCodeBlock();
  if (inMathBlock) flushMathBlock();
  
  if (currentSection.blocks.length > 0) {
    sections.push(currentSection);
  }

  return sections;
};

const parseTable = (rows: string[]): ParsedTable | undefined => {
  if (rows.length < 2) return undefined;

  const contentRows = rows.filter(row => {
      const clean = row.replace(/\|/g, '').trim();
      return !clean.match(/^[- :]+$/); // Filter separator line
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