import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { ParsedSection, ContentType, ParsedTable } from './types';

/**
 * 将 Markdown 字符串解析为结构化的章节列表
 * @param markdown 待解析的 Markdown 文本
 * @returns 解析后的章节数组
 */
export const parseMarkdownToSections = (markdown: string): ParsedSection[] => {
  if (typeof markdown !== 'string') {
    throw new Error('Markdown 输入必须是字符串');
  }

  // 预处理：彻底还原被转义的 LaTeX 字符，确保导出到 Word 时公式完整
  const processedMarkdown = markdown
    .replace(/\\(\$\$?)/g, '$1')           // \$ -> $, \$$ -> $$
    .replace(/\\([__{}])/g, '$1')          // \_ -> _, \{ -> { 等
    .replace(/\\\\([a-zA-Z]+)/g, '\\$1');  // \\frac -> \frac

  try {
    // 配置解析器，支持 GFM (表格、任务列表等) 和 Math (数学公式)
    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath);
    
    const tree = processor.parse(processedMarkdown);
    const sections: ParsedSection[] = [];
    let currentSection: ParsedSection = { title: '简介', level: 1, blocks: [] };

    /**
     * 将当前正在构建的章节推送到结果数组中
     */
    const flushSection = () => {
      if (currentSection.blocks.length > 0 || (currentSection.title !== '简介' && currentSection.title !== '')) {
        sections.push({ ...currentSection });
      }
    };

    /**
     * 递归获取节点的文本内容，支持粗体、斜体和行内公式的标记转换
     * @param node Markdown AST 节点
     */
    const getTextContent = (node: any): string => {
      if (node.value) return node.value;
      if (node.children) {
        return node.children.map((c: any) => {
          if (c.type === 'strong') return `**${getTextContent(c)}**`;
          if (c.type === 'emphasis') return `*${getTextContent(c)}*`;
          if (c.type === 'inlineMath') return `$${c.value}$`;
          return getTextContent(c);
        }).join('');
      }
      return '';
    };

    const nodes = (tree as any).children;

    // 遍历所有顶层节点并转换为内部块格式
    for (const node of nodes) {
      switch (node.type) {
        case 'heading':
          flushSection();
          currentSection = {
            title: getTextContent(node),
            level: node.depth,
            blocks: []
          };
          break;

        case 'paragraph':
          currentSection.blocks.push({
            type: ContentType.PARAGRAPH,
            content: getTextContent(node)
          });
          break;

        case 'code':
          currentSection.blocks.push({
            type: ContentType.CODE_BLOCK,
            content: node.value,
            language: node.lang || ''
          });
          break;

        case 'math':
          currentSection.blocks.push({
            type: ContentType.CODE_BLOCK,
            content: node.value,
            language: 'math'
          });
          break;

        case 'table':
          const tableData: ParsedTable = {
            headers: node.children[0].children.map((cell: any) => getTextContent(cell)),
            rows: node.children.slice(1).map((row: any) => 
              row.children.map((cell: any) => getTextContent(cell))
            )
          };
          currentSection.blocks.push({
            type: ContentType.TABLE,
            content: '',
            tableData
          });
          break;

        case 'blockquote':
          currentSection.blocks.push({
            type: ContentType.BLOCKQUOTE,
            content: node.children.map((c: any) => getTextContent(c)).join('\n')
          });
          break;

        case 'thematicBreak':
          currentSection.blocks.push({
            type: ContentType.HR,
            content: ''
          });
          break;

        case 'list':
          node.children.forEach((listItem: any) => {
            currentSection.blocks.push({
              type: ContentType.LIST_ITEM,
              content: listItem.children.map((c: any) => getTextContent(c)).join('\n')
            });
          });
          break;
      }
    }

    flushSection();
    // 确保至少有一个章节返回
    return sections.length > 0 ? sections : [currentSection];
  } catch (error) {
    console.error('Markdown 解析失败:', error);
    return [{ title: '解析错误', level: 1, blocks: [{ type: ContentType.PARAGRAPH, content: '解析失败，请检查 Markdown 格式' }] }];
  }
};
