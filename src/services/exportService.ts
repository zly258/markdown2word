import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, ImageRun, ShadingType, Math as DocxMath } from 'docx';
import saveAs from 'file-saver';
import mermaid from 'mermaid';
import katex from 'katex';

// 移除了html2canvas导入，因为已删除PDF导出功能
import { parseMarkdownToSections } from '../utils/markdownParser';
import { ContentType } from '../types';

// 初始化mermaid用于无头渲染
mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
});

// 导出选项类型
interface ExportOptions {
    chartTheme: 'default' | 'neutral' | 'forest' | 'base';
    mathMode: 'mathml'; // 固定为mathml模式
}

// 将LaTeX转换为MathML的函数
const convertLatexToMathML = (latex: string): string => {
    try {
        // 使用KaTeX将LaTeX转换为MathML
        const mathML = katex.renderToString(latex, {
            displayMode: true,
            output: "mathml"
        });
        return mathML;
    } catch (error) {
        console.error('LaTeX to MathML conversion error:', error);
        // 如果转换失败，返回原始LaTeX作为后备
        return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
          <semantics>
            <mrow>
              <mi mathvariant="normal">LaTeX</mi>
              <mo>:</mo>
              <mi>${latex}</mi>
            </mrow>
            <annotation encoding="application/x-tex">${latex}</annotation>
          </semantics>
        </math>`;
    }
};

// 将MathML字符串转换为docx.Math对象
const convertMathMLToDocxMath = (mathML: string): DocxMath => {
    // 在实际应用中，您可能需要解析MathML并将其转换为docx库支持的格式
    // 目前我们只是创建一个占位符
    return new DocxMath({
        children: [
            new TextRun({
                text: `[MathML公式: ${mathML.substring(0, 30)}...]`,
                color: "0000FF",
                italics: true
            })
        ]
    });
};

// 生成Mermaid图表图片
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
                // 优化图片大小：使用更合适的缩放比例
                const scale = 2.0; // 降低缩放比例以减小文件大小
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
                    }, 'image/png', 0.8); // 添加质量参数以进一步减小文件大小
                } else {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
        });
    } catch (e) {
        console.error("Mermaid渲染错误:", e);
        return null;
    }
};

// 获取图片尺寸
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

// 解析段落内容
const parseParagraphContent = async (
    text: string, 
    options: ExportOptions,
    defaults: { bold?: boolean, size?: number } = {}
): Promise<(TextRun | ImageRun | DocxMath)[]> => {
    const children: (TextRun | ImageRun | DocxMath)[] = [];
    
    // 按数学标记分割：$...$ (行内数学)
    const regex = /(\$[^$]+\$)/g;
    const parts = text.split(regex);
    
    for (const part of parts) {
        if (part.startsWith('$') && part.endsWith('$')) {
            const cleanMath = part.replace(/^\$|\$$/g, '');
            
            // 使用MathML格式导出公式
            const mathML = convertLatexToMathML(cleanMath);
            const docxMath = convertMathMLToDocxMath(mathML);
            children.push(docxMath);
        } else {
            const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
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
        }
    }
    return children;
};

// 获取标题级别
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

export const exportToDocx = async (
    markdown: string, 
    filename: string = 'document', 
    options: ExportOptions = { chartTheme: 'default', mathMode: 'mathml' }
) => {
  const sections = parseMarkdownToSections(markdown);
  const docChildren: (Paragraph | Table)[] = [];

  docChildren.push(
    new Paragraph({
      text: "AI 生成文档",
      heading: HeadingLevel.TITLE,
      spacing: { after: 400 }
    })
  );

  for (const section of sections) {
    docChildren.push(
      new Paragraph({
        text: section.title,
        heading: getHeadingLevel(section.level),
        spacing: { before: 240, after: 120 }
      })
    );

    for (const block of section.blocks) {
        if (block.type === ContentType.CODE_BLOCK) {
            
            if (block.language === 'mermaid') {
                const imageBuffer = await generateMermaidImage(block.content, options.chartTheme);
                if (imageBuffer) {
                    const { width, height } = await getImageDimensions(imageBuffer);
                    const MAX_WIDTH = 500; 
                    let finalWidth = width;
                    let finalHeight = height;
                    
                    const displayWidth = width / 2.0;
                    const displayHeight = height / 2.0;
                    
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
                                transformation: { width: finalWidth, height: finalHeight }
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

            const isMathBlock = block.content.trim().startsWith('$$') && block.content.trim().endsWith('$$');
            if (isMathBlock || block.language === 'latex' || block.language === 'math') {
                 const latex = block.content.replace(/^\$\$|\$\$$/g, '').trim();
                 
                 // 使用MathML格式导出公式
                 const mathML = convertLatexToMathML(latex);
                 const docxMath = convertMathMLToDocxMath(mathML);
                 docChildren.push(new Paragraph({
                     children: [docxMath],
                     alignment: AlignmentType.CENTER,
                     spacing: { after: 200 }
                 }));
                 continue;
            }

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
            const children = await parseParagraphContent(block.content, options);
            docChildren.push(
                new Paragraph({
                  children: children,
                  bullet: { level: 0 },
                  spacing: { after: 80 }
                })
            );
        }
        // 添加对引用块的支持
        else if (block.type === ContentType.BLOCKQUOTE) {
            const children = await parseParagraphContent(block.content, options);
            docChildren.push(
                new Paragraph({
                  children: children,
                  spacing: { after: 80 },
                  indent: { left: 400 }, // 缩进表示引用
                  shading: { fill: "F0F0F0" } // 浅灰色背景
                })
            );
        }
        // 添加对水平线的支持
        else if (block.type === ContentType.HR) {
            docChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "",
                      break: 1
                    })
                  ],
                  spacing: { after: 200 },
                  border: {
                    bottom: {
                      style: BorderStyle.SINGLE,
                      size: 6,
                      space: 1,
                      color: "CCCCCC"
                    }
                  }
                })
            );
        }
        else {
             if (block.content.trim().startsWith('$$') && block.content.trim().endsWith('$$')) {
                 const latex = block.content.replace(/^\$\$|\$\$$/g, '').trim();
                 
                 // 使用MathML格式导出公式
                 const mathML = convertLatexToMathML(latex);
                 const docxMath = convertMathMLToDocxMath(mathML);
                 docChildren.push(new Paragraph({
                     children: [docxMath],
                     alignment: AlignmentType.CENTER,
                     spacing: { after: 120 }
                 }));

             } else {
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
  }

  const doc = new Document({
    creator: "Markdown2Word",
    title: "Exported Document",
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
            heading4: {
                run: { size: 28, bold: true, color: "334155" },
                paragraph: { spacing: { before: 200, after: 100 } }
            },
            heading5: {
                run: { size: 24, bold: true, color: "334155" },
                paragraph: { spacing: { before: 200, after: 100 } }
            },
            heading6: {
                run: { size: 22, bold: true, italics: true, color: "475569" },
                paragraph: { spacing: { before: 200, after: 100 } }
            },
            document: {
                run: { size: 24, font: "Arial" },
                paragraph: { spacing: { line: 360 } }
            }
        }
    },
    sections: [{
      properties: {},
      children: docChildren,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
};