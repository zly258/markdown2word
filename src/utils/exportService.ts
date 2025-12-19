import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, ImageRun, ShadingType } from 'docx';
import saveAs from 'file-saver';
import mermaid from 'mermaid';

import { parseMarkdownToSections } from './markdownParser';
import { ContentType } from './types';

// 初始化 mermaid 用于无头渲染图表
mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
});

// 导出选项接口
interface ExportOptions {
    chartTheme: 'default' | 'neutral' | 'forest' | 'base';
}

/**
 * 生成 Mermaid 图表的图片 ArrayBuffer
 * @param code Mermaid 源码
 * @param theme 主题
 */
const generateMermaidImage = async (code: string, theme: string): Promise<ArrayBuffer | null> => {
    try {
        mermaid.initialize({
            startOnLoad: false,
            theme: theme as any, 
            securityLevel: 'loose',
        });

        const id = `mermaid-export-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, code);

        return new Promise((resolve) => {
            const img = new Image();
            const svg64 = btoa(unescape(encodeURIComponent(svg)));
            img.src = `data:image/svg+xml;base64,${svg64}`;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // 缩放比例，平衡清晰度与文件大小
                const scale = 2.0; 
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    canvas.toBlob((blob) => {
                        if (blob) {
                            blob.arrayBuffer().then(resolve);
                        } else {
                            resolve(null);
                        }
                    }, 'image/png', 0.8);
                } else {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
        });
    } catch (e) {
        console.error("Mermaid 渲染错误:", e);
        return null;
    }
};

/**
 * 获取图片的原始尺寸
 */
const getImageDimensions = (buffer: ArrayBuffer): Promise<{width: number, height: number}> => {
    return new Promise((resolve) => {
        const blob = new Blob([buffer]);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(img.src);
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            resolve({ width: 0, height: 0 });
        };
        img.src = URL.createObjectURL(blob);
    });
};

/**
 * 解析包含粗体和斜体的文本段落
 */
const parseParagraphContent = async (
    text: string, 
    options: ExportOptions,
    defaults: { bold?: boolean, size?: number } = {}
): Promise<(TextRun | ImageRun)[]> => {
    const children: (TextRun | ImageRun)[] = [];
    
    // 解析 Markdown 格式的段落内容（支持 **粗体** 和 *斜体*）
    const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
    for (const bPart of boldParts) {
        if (bPart.startsWith('**') && bPart.endsWith('**')) {
            children.push(new TextRun({
                text: bPart.slice(2, -2),
                bold: true,
                size: defaults.size || 24 
            }));
        } else {
             const italicParts = bPart.split(/(\*[^*]+\*)/g);
             for (const iPart of italicParts) {
                if (iPart.startsWith('*') && iPart.endsWith('*') && iPart.length > 2) {
                     children.push(new TextRun({
                        text: iPart.slice(1, -1),
                        italics: true,
                        bold: defaults.bold,
                        size: defaults.size || 24
                    }));
                } else if (iPart) {
                    children.push(new TextRun({
                        text: iPart,
                        bold: defaults.bold,
                        size: defaults.size || 24
                    }));
                }
             }
        }
    }
    return children;
};

/**
 * 转换数字标题级别为 docx 对应的枚举
 */
const getHeadingLevel = (level: number) => {
    switch(level) {
        case 1: return HeadingLevel.HEADING_1;
        case 2: return HeadingLevel.HEADING_2;
        case 3: return HeadingLevel.HEADING_3;
        case 4: return HeadingLevel.HEADING_4;
        case 5: return HeadingLevel.HEADING_5;
        case 6: return HeadingLevel.HEADING_6;
        default: return HeadingLevel.HEADING_1;
    }
};

/**
 * 核心导出函数：将 Markdown 导出为 Word 文档
 * @param markdown Markdown 源码
 * @param filename 导出的文件名
 * @param options 导出配置
 */
export const exportToDocx = async (
    markdown: string, 
    filename: string = 'document', 
    options: ExportOptions = { chartTheme: 'default' }
) => {
  const sections = parseMarkdownToSections(markdown);
  const docChildren: (Paragraph | Table)[] = [];

  // 添加文档标题
  docChildren.push(
    new Paragraph({
      text: "Markdown2Word 生成文档",
      heading: HeadingLevel.TITLE,
      spacing: { after: 400 }
    })
  );

  for (const section of sections) {
    // 添加章节标题
    docChildren.push(
      new Paragraph({
        text: section.title,
        heading: getHeadingLevel(section.level),
        spacing: { before: 240, after: 120 }
      })
    );

    // 遍历章节下的内容块
    for (const block of section.blocks) {
        if (block.type === ContentType.CODE_BLOCK) {
            // 特殊处理 Mermaid 图表
            if (block.language === 'mermaid') {
                const imageBuffer = await generateMermaidImage(block.content, options.chartTheme);
                if (imageBuffer) {
                    const { width, height } = await getImageDimensions(imageBuffer);
                    const MAX_WIDTH = 600; 
                    let finalWidth = width;
                    let finalHeight = height;
                    
                    const displayWidth = width / 1.5;
                    const displayHeight = height / 1.5;
                    
                    if (displayWidth > MAX_WIDTH) {
                        const ratio = MAX_WIDTH / displayWidth;
                        finalWidth = MAX_WIDTH;
                        finalHeight = displayHeight * ratio;
                    } else {
                        finalWidth = displayWidth;
                        finalHeight = displayHeight;
                    }

                    docChildren.push(new Paragraph({
                        children: [
                            new ImageRun({
                                data: new Uint8Array(imageBuffer),
                                transformation: { width: finalWidth, height: finalHeight },
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 200 }
                    }));
                } else {
                     docChildren.push(new Paragraph({
                        children: [ new TextRun({ text: "[图表生成失败]", color: "FF0000" }) ],
                        alignment: AlignmentType.CENTER
                    }));
                }
                continue;
            }

            // 普通代码块处理
            const codeLines = block.content.split('\n');
            const codeRuns = codeLines.map((line, index) => 
                new TextRun({
                    text: line,
                    font: "Courier New",
                    size: 20,
                    color: "333333",
                    break: index > 0 ? 1 : 0 
                })
            );

            docChildren.push(
                new Paragraph({
                    children: codeRuns,
                    shading: { type: ShadingType.CLEAR, fill: "F5F5F5" },
                    border: { left: { style: BorderStyle.SINGLE, size: 6, space: 4, color: "CCCCCC" } },
                    spacing: { before: 100, after: 100 },
                    alignment: AlignmentType.LEFT
                })
            );
        }
        else if (block.type === ContentType.TABLE && block.tableData) {
            // 表格处理
            const { headers, rows } = block.tableData;
            
            const headerCells: TableCell[] = [];
            for (const h of headers) {
                const children = await parseParagraphContent(h, options, { bold: true, size: 24 });
                
                headerCells.push(new TableCell({
                    children: [new Paragraph({ children: children, alignment: AlignmentType.CENTER })],
                    shading: { fill: "F1F5F9" }, 
                    verticalAlign: "center",
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                    borders: {
                         top: { style: BorderStyle.SINGLE, size: 1, color: "94A3B8" },
                         bottom: { style: BorderStyle.SINGLE, size: 1, color: "94A3B8" },
                         left: { style: BorderStyle.SINGLE, size: 1, color: "94A3B8" },
                         right: { style: BorderStyle.SINGLE, size: 1, color: "94A3B8" },
                    }
                }));
            }

            const dataRows: TableRow[] = [];
            for (const r of rows) {
                const cells: TableCell[] = [];
                for (const cellTxt of r) {
                    const children = await parseParagraphContent(cellTxt, options);
                    cells.push(new TableCell({
                        children: [new Paragraph({ children: children })],
                        margins: { top: 100, bottom: 100, left: 100, right: 100 },
                        borders: {
                             top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
                             bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
                             left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
                             right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
                        }
                    }));
                }
                dataRows.push(new TableRow({ children: cells }));
            }

            docChildren.push(
                new Table({
                    rows: [ new TableRow({ children: headerCells, tableHeader: true }), ...dataRows ],
                    width: { size: 100, type: WidthType.PERCENTAGE },
                })
            );
            docChildren.push(new Paragraph(""));
        }
        else if (block.type === ContentType.LIST_ITEM) {
            // 列表项处理
            const children = await parseParagraphContent(block.content, options);
            docChildren.push(
                new Paragraph({
                  children: children,
                  bullet: { level: 0 },
                  spacing: { after: 80 }
                })
            );
        }
        else if (block.type === ContentType.BLOCKQUOTE) {
            // 引用块处理
            const children = await parseParagraphContent(block.content, options);
            docChildren.push(
                new Paragraph({
                  children: children,
                  spacing: { after: 80 },
                  indent: { left: 400 },
                  shading: { fill: "F0F0F0" }
                })
            );
        }
        else if (block.type === ContentType.HR) {
            // 水平线处理
            docChildren.push(
                new Paragraph({
                  children: [ new TextRun({ text: "", break: 1 }) ],
                  spacing: { after: 200 },
                  border: {
                    bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: "CCCCCC" }
                  }
                })
            );
        }
        else {
            // 普通段落处理
            const children = await parseParagraphContent(block.content, options);
            docChildren.push(
                new Paragraph({
                    children: children,
                    spacing: { after: 120 },
                    alignment: AlignmentType.JUSTIFIED
                })
            );
        }
    }
  }

  // 构建文档对象
  const doc = new Document({
    creator: "Markdown2Word",
    title: "导出文档",
    styles: {
        default: {
            heading1: {
                run: { size: 48, bold: true, color: "0F172A" }, 
                paragraph: { spacing: { before: 300, after: 150 } }
            },
            heading2: {
                run: { size: 40, bold: true, color: "0F172A" },
                paragraph: { spacing: { before: 260, after: 140 } }
            },
            heading3: {
                run: { size: 32, bold: true, color: "1E293B" },
                paragraph: { spacing: { before: 240, after: 120 } }
            },
            document: {
                run: { size: 24, font: "Microsoft YaHei" }, // 使用微软雅黑
                paragraph: { spacing: { line: 360 } }
            }
        }
    },
    sections: [{
      properties: {},
      children: docChildren,
    }],
  });

  // 打包并保存文件
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
};
