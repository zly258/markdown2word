import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, ImageRun, ShadingType, Math as DocxMath, MathRun, MathFraction, MathRadical, MathSuperScript, MathSubScript } from 'docx';
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

const mermaidImageCache = new Map<string, ArrayBuffer>();

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> => {
    return new Promise((resolve) => {
        let finished = false;
        const timer = setTimeout(() => {
            if (!finished) resolve(null);
        }, ms);
        promise.then((v) => {
            finished = true;
            clearTimeout(timer);
            resolve(v);
        }).catch(() => {
            finished = true;
            clearTimeout(timer);
            resolve(null);
        });
    });
};

/**
 * 生成 Mermaid 图表的图片 ArrayBuffer
 * @param code Mermaid 源码
 * @param theme 主题
 */
const generateMermaidImage = async (code: string, theme: string): Promise<ArrayBuffer | null> => {
    try {
        const cacheKey = `${theme}|${code}`;
        const cached = mermaidImageCache.get(cacheKey);
        if (cached) return cached;

        mermaid.initialize({
            startOnLoad: false,
            theme: theme as any, 
            securityLevel: 'loose',
        });

        const id = `mermaid-export-${Math.random().toString(36).substr(2, 9)}`;
        const renderResult = await withTimeout(mermaid.render(id, code), 4000);
        if (!renderResult) return null;
        const { svg } = renderResult as { svg: string };

        const rendered: ArrayBuffer | null = await new Promise((resolve) => {
            const img = new Image();
            const svg64 = btoa(unescape(encodeURIComponent(svg)));
            img.src = `data:image/svg+xml;base64,${svg64}`;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // 根据图复杂度动态调整缩放，避免大图卡顿
                const nodeMatches = (code.match(/[A-Za-z0-9_]+\s*\[/g) || []).length;
                const edgeMatches = (code.match(/-->|==>|--|==/g) || []).length;
                const complexity = nodeMatches + edgeMatches;
                let scale = 4.0;
                if (complexity > 60) scale = 2.2;
                else if (complexity > 30) scale = 2.8;
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
                    }, 'image/png', 0.9);
                } else {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
            setTimeout(() => resolve(null), 4000);
        });
        if (rendered) {
            mermaidImageCache.set(cacheKey, rendered);
        }
        return rendered;
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
        let revoked = false;
        const url = URL.createObjectURL(blob);
        const timer = setTimeout(() => {
            if (!revoked) {
                URL.revokeObjectURL(url);
                revoked = true;
            }
            resolve({ width: 0, height: 0 });
        }, 2000);
        img.onload = () => {
            clearTimeout(timer);
            if (!revoked) {
                URL.revokeObjectURL(url);
                revoked = true;
            }
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
            clearTimeout(timer);
            if (!revoked) {
                URL.revokeObjectURL(url);
                revoked = true;
            }
            resolve({ width: 0, height: 0 });
        };
        img.src = url;
    });
};

const latexToComponents = (latex: string): (MathRun | MathFraction | MathRadical | MathSuperScript | MathSubScript)[] => {
    // 预处理常见环境：pmatrix -> ( rows; ... )
    const normalizeMatrixEnv = (input: string): string => {
        let s = input;
        const beginTag = '\\begin{pmatrix}';
        const endTag = '\\end{pmatrix}';
        let start = s.indexOf(beginTag);
        while (start !== -1) {
            const end = s.indexOf(endTag, start + beginTag.length);
            if (end === -1) break;
            const inner = s.slice(start + beginTag.length, end);
            const rows = inner.split('\\\\').map(r => r.trim());
            const rowStr = rows.map(r => r.split('&').map(c => c.trim()).join(', ')).join('; ');
            const replaced = `( ${rowStr} )`;
            s = s.slice(0, start) + replaced + s.slice(end + endTag.length);
            start = s.indexOf(beginTag, start + replaced.length);
        }
        return s;
    };
    latex = normalizeMatrixEnv(latex);
    const out: (MathRun | MathFraction | MathRadical | MathSuperScript | MathSubScript)[] = [];
    let i = 0;
    const readGroup = (): string => {
        if (latex[i] === '{') {
            let depth = 0;
            let start = i;
            while (i < latex.length) {
                if (latex[i] === '{') depth++;
                else if (latex[i] === '}') {
                    depth--;
                    if (depth === 0) { i++; break; }
                }
                i++;
            }
            return latex.slice(start + 1, i - 1);
        } else {
            let start = i;
            while (i < latex.length && !['^', '_', ' ', '\\', '{', '}', '/'].includes(latex[i])) i++;
            return latex.slice(start, i);
        }
    };
    const pushRun = (text: string) => {
        if (!text) return;
        out.push(new MathRun(text));
    };
    while (i < latex.length) {
        const ch = latex[i];
        if (ch === '\\') {
            const start = i;
            i++;
            while (i < latex.length && /[a-zA-Z]/.test(latex[i])) i++;
            const cmd = latex.slice(start + 1, i);
            if (cmd === 'frac') {
                if (latex[i] === '{') {
                    const num = readGroup();
                    if (latex[i] === '{') {
                        const den = readGroup();
                        out.push(new MathFraction({ numerator: latexToComponents(num), denominator: latexToComponents(den) }));
                    }
                }
            } else if (cmd === 'sqrt') {
                if (latex[i] === '{') {
                    const inner = readGroup();
                    out.push(new MathRadical({ children: latexToComponents(inner) }));
                }
            } else if (cmd === 'alpha') pushRun('α');
            else if (cmd === 'beta') pushRun('β');
            else if (cmd === 'theta') pushRun('θ');
            else if (cmd === 'omega') pushRun('ω');
            else if (cmd === 'mu') pushRun('μ');
            else if (cmd === 'sigma') pushRun('σ');
            else if (cmd === 'leq') pushRun('≤');
            else if (cmd === 'geq') pushRun('≥');
            else if (cmd === 'neq') pushRun('≠');
            else if (cmd === 'infty') pushRun('∞');
            else if (cmd === 'cdot') pushRun('·');
            else if (cmd === 'pm') pushRun('±');
            else if (cmd === 'ldots') pushRun('…');
            else if (cmd === 'cdots') pushRun('⋯');
            else if (cmd === 'int') pushRun('∫');
            else if (cmd === 'mathcal') {
                if (latex[i] === '{') {
                    const inner = readGroup();
                    pushRun(inner);
                }
            }
            else {
                pushRun(cmd);
            }
        } else if (ch === '^') {
            i++;
            const sup = latex[i] === '{' ? readGroup() : readGroup();
            const prev = out.pop();
            const base = prev ? [prev] : [new MathRun('')];
            out.push(new MathSuperScript({ children: base, superScript: latexToComponents(sup) }));
        } else if (ch === '_') {
            i++;
            const sub = latex[i] === '{' ? readGroup() : readGroup();
            const prev = out.pop();
            const base = prev ? [prev] : [new MathRun('')];
            out.push(new MathSubScript({ children: base, subScript: latexToComponents(sub) }));
        } else if (ch === ' ') {
            i++;
            pushRun(' ');
        } else {
            let start = i;
            while (i < latex.length && !['^', '_', ' ', '\\', '{', '}', '/'].includes(latex[i])) i++;
            pushRun(latex.slice(start, i));
        }
    }
    return out;
};

/**
 * 解析包含粗体和斜体的文本段落
 */
const parseParagraphContent = async (
    text: string, 
    options: ExportOptions,
    defaults: { bold?: boolean, size?: number } = {}
): Promise<(TextRun | ImageRun | DocxMath)[]> => {
    const children: (TextRun | ImageRun | DocxMath)[] = [];
    const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$]+\$)/g);
    for (const part of parts) {
        if (!part) continue;
        if ((part.startsWith('$$') && part.endsWith('$$')) || (part.startsWith('$') && part.endsWith('$'))) {
            const inner = part.replace(/^\$\$?|\$\$?$/g, '').trim();
            const comps = latexToComponents(inner);
            children.push(new DocxMath({ children: comps }));
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
                    const MAX_WIDTH = 800; 
                    let baseWidth = width > 0 ? width / 5.0 : 640;
                    let baseHeight = height > 0 ? height / 5.0 : 360;
                    let finalWidth = baseWidth * 1.6;
                    let finalHeight = baseHeight * 1.6;
                    if (finalWidth > MAX_WIDTH) {
                        const ratio = MAX_WIDTH / finalWidth;
                        finalWidth = MAX_WIDTH;
                        finalHeight = finalHeight * ratio;
                    }

                    docChildren.push(new Paragraph({
                        children: [
                            new ImageRun({
                                data: new Uint8Array(imageBuffer),
                                transformation: { width: finalWidth, height: finalHeight },
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 300, after: 300 }
                    }));
                } else {
                     docChildren.push(new Paragraph({
                        children: [ new TextRun({ text: "[图表生成失败或超时]", color: "FF0000" }) ],
                        alignment: AlignmentType.CENTER
                    }));
                }
                continue;
            }

            if (block.language === 'math') {
                const comps = latexToComponents(block.content);
                docChildren.push(new Paragraph({
                    children: [new DocxMath({ children: comps })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 240, after: 240 }
                }));
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
