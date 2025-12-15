import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, ImageRun, ShadingType, Math as DocxMath, MathRun, MathFraction, MathSum, MathIntegral, MathRadical, MathLimitLower, MathSuperScript, MathSubScript, MathSubSuperScript } from 'docx';
import saveAs from 'file-saver';
import mermaid from 'mermaid';
import { parseMarkdownToSections } from '../utils/markdownParser';
import { ContentType } from '../types';

// Initialize mermaid for headless rendering
mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
});

// Types for options
interface ExportOptions {
    chartTheme: 'default' | 'neutral' | 'forest' | 'base';
    mathMode: 'native' | 'image';
}

// Map LaTeX commands to Unicode/Word symbols
// Word math often prefers the unicode char itself for variables
const LATEX_MAP: Record<string, string> = {
    'theta': 'θ', 'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ', 'epsilon': 'ε',
    'lambda': 'λ', 'mu': 'μ', 'pi': 'π', 'rho': 'ρ', 'sigma': 'σ', 'tau': 'τ', 'phi': 'φ',
    'omega': 'ω', 'Delta': 'Δ', 'Sigma': 'Σ', 'Omega': 'Ω',
    'infty': '∞', 'pm': '±', 'times': '×', 'div': '÷', 'neq': '≠', 'leq': '≤', 'geq': '≥',
    'approx': '≈', 'cdot': '·', 'rightarrow': '→', 'leftarrow': '←', 'Rightarrow': '⇒',
    'partial': '∂', 'nabla': '∇', 'dots': '…', 'cdots': '⋯',
    'in': '∈', 'notin': '∉', 'subset': '⊂', 'subseteq': '⊆',
    'forall': '∀', 'exists': '∃',
    ' ': ' ', 
    ',': ',',
    ';': ';',
    '|': '|',
    '=': '=',
    '+': '+',
    '-': '-',
    '<': '<',
    '>': '>',
    '(': '(',
    ')': ')',
    '[': '[',
    ']': ']',
    '{': '{',
    '}': '}'
};

// --- Latex Parser Logic ---

type MathNode = 
    | { type: 'text', val: string, style?: 'plain' | 'italic' } // style plain = upright (for functions/numbers)
    | { type: 'cmd', val: string }
    | { type: 'group', children: MathNode[] }
    | { type: 'fraction', num: MathNode[], den: MathNode[] }
    | { type: 'radical', deg?: MathNode[], children: MathNode[] } 
    | { type: 'sum', sub?: MathNode[], sup?: MathNode[], isIntegral?: boolean } 
    | { type: 'limit', base: string, sub: MathNode[] } 
    | { type: 'accent', accent: string, children: MathNode[] }
    | { type: 'script', base: MathNode[], sub?: MathNode[], sup?: MathNode[] };

/**
 * A robust tokenizer/parser for standard scientific LaTeX.
 */
const parseLatexToStructure = (latex: string): MathNode[] => {
    let cursor = 0;
    const n = latex.length;

    const readGroup = (): MathNode[] => {
        // Skip '{'
        cursor++;
        const nodes: MathNode[] = [];
        while (cursor < n && latex[cursor] !== '}') {
            nodes.push(...parseNext());
        }
        cursor++; // Skip '}'
        return nodes;
    };

    const readOptionalGroup = (): MathNode[] | undefined => {
        // Look ahead for '['
        let tempCursor = cursor;
        while(tempCursor < n && /\s/.test(latex[tempCursor])) tempCursor++;
        
        if (latex[tempCursor] === '[') {
            cursor = tempCursor + 1;
            const nodes: MathNode[] = [];
            while (cursor < n && latex[cursor] !== ']') {
                nodes.push(...parseNext());
            }
            cursor++; // Skip ']'
            return nodes;
        }
        return undefined;
    };

    const parseNext = (): MathNode[] => {
        if (cursor >= n) return [];
        const char = latex[cursor];

        // 1. Groups
        if (char === '{') {
            return [{ type: 'group', children: readGroup() }];
        }
        
        // 2. Commands
        if (char === '\\') {
            cursor++;
            let cmd = '';
            while (cursor < n && /[a-zA-Z]/.test(latex[cursor])) {
                cmd += latex[cursor];
                cursor++;
            }
            // Handle special single-char commands or escaped chars
            if (cmd === '' && cursor < n) {
                cmd = latex[cursor];
                cursor++;
            }
            
            // Ignore \left and \right (Word math handles resizing automatically)
            if (cmd === 'left' || cmd === 'right') {
                return []; 
            }
            
            // Spacing
            if (cmd === ',' || cmd === ';' || cmd === ' ' || cmd === 'quad') {
                return [{ type: 'text', val: ' ', style: 'plain' }];
            }

            // Fractions
            if (cmd === 'frac') {
                let num: MathNode[] = [];
                let den: MathNode[] = [];
                
                // Eat whitespace
                while(cursor < n && /\s/.test(latex[cursor])) cursor++;
                if (latex[cursor] === '{') num = readGroup();
                else num = parseNext();

                while(cursor < n && /\s/.test(latex[cursor])) cursor++;
                if (latex[cursor] === '{') den = readGroup();
                else den = parseNext();

                return [{ type: 'fraction', num, den }];
            }

            // Square Root
            if (cmd === 'sqrt') {
                const deg = readOptionalGroup();
                let content: MathNode[] = [];
                while(cursor < n && /\s/.test(latex[cursor])) cursor++;
                if (latex[cursor] === '{') content = readGroup();
                else content = parseNext();
                
                return [{ type: 'radical', deg, children: content }];
            }

            // Accents
            if (['vec', 'bar', 'hat', 'dot', 'ddot'].includes(cmd)) {
                 let content: MathNode[] = [];
                 while(cursor < n && /\s/.test(latex[cursor])) cursor++;
                 if (latex[cursor] === '{') content = readGroup();
                 else content = parseNext();
                 return [{ type: 'accent', accent: cmd, children: content }];
            }

            // N-ary
            if (cmd === 'sum' || cmd === 'prod') {
                return [{ type: 'sum', isIntegral: false }]; 
            }
            if (cmd === 'int') {
                return [{ type: 'sum', isIntegral: true }];
            }

            // Limits
            if (cmd === 'lim') {
                 return [{ type: 'limit', base: 'lim', sub: [] }]; 
            }

            // Functions - Render as plain text (non-italic)
            // Added more common functions
            if (['log', 'sin', 'cos', 'tan', 'ln', 'max', 'min', 'exp', 'lim', 'det', 'sup', 'inf'].includes(cmd)) {
                return [{ type: 'text', val: cmd, style: 'plain' }];
            }

            // Text
            if (cmd === 'text') {
                 let content: MathNode[] = [];
                 while(cursor < n && /\s/.test(latex[cursor])) cursor++;
                 if (latex[cursor] === '{') content = readGroup();
                 // Flatten the group into a single string if possible
                 const textStr = content.map(c => c.type === 'text' ? c.val : '').join('');
                 return [{ type: 'text', val: textStr, style: 'plain' }];
            }

            return [{ type: 'cmd', val: cmd }];
        }

        // 3. Sub/Superscripts
        if (char === '^' || char === '_') {
            cursor++;
            return [{ type: 'text', val: char }];
        }

        // 4. Special Characters (Pipes, Semicolons, etc)
        if (Object.keys(LATEX_MAP).includes(char)) {
            cursor++;
            return [{ type: 'text', val: char, style: 'plain' }];
        }

        // 5. Whitespace
        if (/\s/.test(char)) {
            cursor++;
            return [];
        }

        // 6. Digits (Group them! This fixes the spacing issue)
        if (/[0-9.]/.test(char)) {
             let val = char;
             cursor++;
             // Consume subsequent digits/dots
             while (cursor < n && /[0-9.]/.test(latex[cursor])) {
                 val += latex[cursor];
                 cursor++;
             }
             return [{ type: 'text', val: val, style: 'plain' }];
        }

        // 7. Basic Text (Letters)
        cursor++;
        // Letters are italic variables by default in math
        return [{ type: 'text', val: char, style: 'italic' }];
    };

    const nodes: MathNode[] = [];
    while (cursor < n) {
        nodes.push(...parseNext());
    }
    return nodes;
};

// Post-process to handle Subscripts, Superscripts, and Limits
const buildMathTree = (nodes: MathNode[]): MathNode[] => {
    const result: MathNode[] = [];
    
    for (let i = 0; i < nodes.length; i++) {
        const current = nodes[i];
        
        // Handle Limits special case: \lim_{x \to 0}
        if (current.type === 'limit') {
             const next = nodes[i + 1];
             if (next && next.type === 'text' && next.val === '_') {
                 const subContent = nodes[i + 2];
                 if (subContent) {
                     result.push({ 
                         type: 'limit', 
                         base: current.base, 
                         sub: flattenNode(subContent) 
                     });
                     i += 2;
                     continue;
                 }
             }
             // If no subscript, treat as text
             result.push({ type: 'text', val: current.base, style: 'plain' });
             continue;
        }

        // Check if next is sub or sup
        const next = nodes[i + 1];
        
        if (next && next.type === 'text' && (next.val === '_' || next.val === '^')) {
            const isSub = next.val === '_';
            const scriptContent = nodes[i + 2];
            
            if (!scriptContent) {
                result.push(current);
                continue;
            }

            // Consume first script
            let sub: MathNode[] | undefined = isSub ? flattenNode(scriptContent) : undefined;
            let sup: MathNode[] | undefined = !isSub ? flattenNode(scriptContent) : undefined;
            let advance = 2; // consumed _ and content

            // Check for second script (e.g. \sum_{i=1}^N)
            const nextNext = nodes[i + 3];
            if (nextNext && nextNext.type === 'text' && (nextNext.val === '^' || nextNext.val === '_')) {
                 const secondIsSub = nextNext.val === '_';
                 // Ensure we don't have two subs or two sups
                 if (secondIsSub !== isSub) {
                     const secondContent = nodes[i + 4];
                     if (secondContent) {
                         if (secondIsSub) sub = flattenNode(secondContent);
                         else sup = flattenNode(secondContent);
                         advance += 2;
                     }
                 }
            }

            if (current.type === 'sum') {
                result.push({ 
                    type: 'sum', 
                    isIntegral: current.isIntegral,
                    sub, 
                    sup 
                });
            } else {
                result.push({ 
                    type: 'script', 
                    base: [current], 
                    sub, 
                    sup 
                });
            }
            i += advance;

        } else {
            result.push(current);
        }
    }
    return result;
};

const flattenNode = (node: MathNode): MathNode[] => {
    if (node.type === 'group') return buildMathTree(node.children);
    return [node];
};

// Helper: Ensure children array is not empty to prevent corruption
const ensureChildren = (children: any[]) => {
    if (!children || children.length === 0) {
        return [new MathRun(" ")];
    }
    return children;
};

// Convert internal MathNodes to Docx objects
const renderToDocxMath = (nodes: MathNode[]): any[] => {
    const output: any[] = [];
    
    for (const node of nodes) {
        if (node.type === 'text') {
            // FIX: Invalid casting of MathRun config caused corruption.
            // Using standard constructor with string value. 
            // docx JS library defaults to standard formatting.
            output.push(new MathRun(node.val));
        }
        else if (node.type === 'cmd') {
            const val = LATEX_MAP[node.val] || node.val;
            output.push(new MathRun(val));
        }
        else if (node.type === 'fraction') {
            output.push(new MathFraction({
                numerator: ensureChildren(renderToDocxMath(node.num)),
                denominator: ensureChildren(renderToDocxMath(node.den))
            }));
        }
        else if (node.type === 'radical') {
            output.push(new MathRadical({
                children: ensureChildren(renderToDocxMath(node.children)),
                degree: node.deg ? ensureChildren(renderToDocxMath(node.deg)) : undefined
            }));
        }
        else if (node.type === 'accent') {
            output.push(...renderToDocxMath(node.children));
        }
        else if (node.type === 'limit') {
             output.push(new MathLimitLower({
                 children: [new MathRun(node.base)],
                 limit: ensureChildren(renderToDocxMath(node.sub))
             }));
        }
        else if (node.type === 'sum') {
            if (node.isIntegral) {
                output.push(new MathIntegral({
                    subScript: node.sub ? ensureChildren(renderToDocxMath(node.sub)) : undefined,
                    superScript: node.sup ? ensureChildren(renderToDocxMath(node.sup)) : undefined,
                    children: [new MathRun("")], // Integral needs a placeholder or the content
                }));
            } else {
                output.push(new MathSum({
                    subScript: node.sub ? ensureChildren(renderToDocxMath(node.sub)) : undefined,
                    superScript: node.sup ? ensureChildren(renderToDocxMath(node.sup)) : undefined,
                    children: [new MathRun("")],
                }));
            }
        }
        else if (node.type === 'script') {
            const base = ensureChildren(renderToDocxMath(node.base));
            const sub = node.sub ? ensureChildren(renderToDocxMath(node.sub)) : undefined;
            const sup = node.sup ? ensureChildren(renderToDocxMath(node.sup)) : undefined;

            if (sub && sup) {
                output.push(new MathSubSuperScript({ children: base, subScript: sub, superScript: sup }));
            } else if (sub) {
                output.push(new MathSubScript({ children: base, subScript: sub }));
            } else if (sup) {
                output.push(new MathSuperScript({ children: base, superScript: sup }));
            } else {
                output.push(...base);
            }
        }
        else if (node.type === 'group') {
             output.push(...renderToDocxMath(node.children));
        }
    }
    return output;
};


const convertLatexToDocxMath = (latex: string) => {
    try {
        const rawNodes = parseLatexToStructure(latex);
        const structuredNodes = buildMathTree(rawNodes);
        const docxNodes = renderToDocxMath(structuredNodes);
        // Safety: Ensure the math block isn't empty
        if (docxNodes.length === 0) return [new MathRun(latex)];
        return docxNodes;
    } catch (e) {
        console.warn("Math parsing failed, falling back to raw text", e);
        return [new MathRun(latex)];
    }
};

// --- Helper Functions for Images ---

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

const generateMathImage = async (latex: string): Promise<ArrayBuffer | null> => {
    try {
        // High DPI request
        const url = `https://latex.codecogs.com/png.image?\\dpi{300}\\bg{white} ${encodeURIComponent(latex)}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const blob = await response.blob();
        return await blob.arrayBuffer();
    } catch (e) {
        console.error("Math Image Generation Failed:", e);
        return null;
    }
};

const generateMermaidImage = async (code: string, theme: string): Promise<ArrayBuffer | null> => {
    try {
        mermaid.initialize({
            startOnLoad: false,
            theme: theme, 
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
                const scale = 2.5; 
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
                    }, 'image/png');
                } else {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
        });
    } catch (e) {
        console.error("Local Mermaid Render Error:", e);
        return null;
    }
};

const parseParagraphContent = async (
    text: string, 
    options: ExportOptions,
    defaults: { bold?: boolean, size?: number } = {}
): Promise<(TextRun | ImageRun | DocxMath)[]> => {
    const children: (TextRun | ImageRun | DocxMath)[] = [];
    
    // Split by math markers: $...$ (Inline Math)
    const regex = /(\$[^$]+\$)/g;
    const parts = text.split(regex);
    
    for (const part of parts) {
        if (part.startsWith('$') && part.endsWith('$')) {
            const cleanMath = part.replace(/^\$|\$$/g, '');
            
            if (options.mathMode === 'image') {
                const imageBuffer = await generateMathImage(cleanMath);
                if (imageBuffer) {
                    const { width, height } = await getImageDimensions(imageBuffer);
                    const targetHeight = 14; 
                    const targetWidth = width * (targetHeight / height);

                    children.push(new ImageRun({
                        data: new Uint8Array(imageBuffer),
                        transformation: { width: targetWidth, height: targetHeight },
                        type: "png"
                    }));
                } else {
                    const mathChildren = convertLatexToDocxMath(cleanMath);
                    children.push(new DocxMath({ children: mathChildren }));
                }
            } else {
                const mathChildren = convertLatexToDocxMath(cleanMath);
                children.push(new DocxMath({ children: mathChildren }));
            }

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

// Helper to map numeric level to Docx HeadingLevel
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
    options: ExportOptions = { chartTheme: 'default', mathMode: 'native' }
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
                    const MAX_WIDTH = 600; 
                    let finalWidth = width;
                    let finalHeight = height;
                    if (width > MAX_WIDTH) {
                        const ratio = MAX_WIDTH / width;
                        finalWidth = MAX_WIDTH;
                        finalHeight = height * ratio;
                    }
                    if (!finalWidth) finalWidth = 400;
                    if (!finalHeight) finalHeight = 300;

                    docChildren.push(new Paragraph({
                        children: [
                            new ImageRun({
                                data: new Uint8Array(imageBuffer),
                                transformation: { width: finalWidth, height: finalHeight },
                                type: "png"
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
                 
                 if (options.mathMode === 'image') {
                    const imageBuffer = await generateMathImage(latex);
                    if (imageBuffer) {
                        const { width, height } = await getImageDimensions(imageBuffer);
                        
                        // Scale Down High-DPI Image
                        const SCALE_FACTOR = 0.24; 
                        
                        const MAX_WIDTH = 450;
                        let finalWidth = width * SCALE_FACTOR;
                        let finalHeight = height * SCALE_FACTOR;
                        
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
                                    type: "png"
                                })
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 200 }
                        }));
                    } else {
                        const mathChildren = convertLatexToDocxMath(latex);
                        docChildren.push(new Paragraph({
                            children: [new DocxMath({ children: mathChildren })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 200 }
                        }));
                    }
                 } else {
                     const mathChildren = convertLatexToDocxMath(latex);
                     docChildren.push(new Paragraph({
                         children: [new DocxMath({ children: mathChildren })],
                         alignment: AlignmentType.CENTER,
                         spacing: { after: 200 }
                     }));
                 }
                 continue;
            }

            // FIX: Handle code block newlines correctly using 'break: 1'
            const codeLines = block.content.split('\n');
            const codeRuns = codeLines.map((line, index) => 
                new TextRun({
                    text: line,
                    font: "Courier New",
                    size: 20,
                    color: "333333",
                    break: index > 0 ? 1 : 0 // Insert break before lines after the first
                })
            );

            docChildren.push(
                new Paragraph({
                    children: codeRuns,
                    shading: { type: ShadingType.CLEAR, fill: "F5F5F5" },
                    border: { left: { style: BorderStyle.SINGLE, size: 6, space: 4, color: "CCCCCC" } },
                    spacing: { before: 100, after: 100 },
                    alignment: AlignmentType.LEFT // FORCE LEFT ALIGNMENT FOR CODE BLOCKS
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
        else {
             if (block.content.trim().startsWith('$$') && block.content.trim().endsWith('$$')) {
                 const latex = block.content.replace(/^\$\$|\$\$$/g, '').trim();
                 
                 if (options.mathMode === 'image') {
                     const imageBuffer = await generateMathImage(latex);
                     if (imageBuffer) {
                         const { width, height } = await getImageDimensions(imageBuffer);
                         
                         const SCALE_FACTOR = 0.24; 
                         const MAX_WIDTH = 450;
                         let finalWidth = width * SCALE_FACTOR;
                         let finalHeight = height * SCALE_FACTOR;
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
                                    type: "png"
                                })
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 120 }
                         }));
                     } else {
                         const mathChildren = convertLatexToDocxMath(latex);
                         docChildren.push(new Paragraph({
                            children: [new DocxMath({ children: mathChildren })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 120 }
                         }));
                     }
                 } else {
                     const mathChildren = convertLatexToDocxMath(latex);
                     docChildren.push(new Paragraph({
                         children: [new DocxMath({ children: mathChildren })],
                         alignment: AlignmentType.CENTER,
                         spacing: { after: 120 }
                     }));
                 }

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