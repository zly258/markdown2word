import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import ExportButtons, { ChartTheme } from './components/ExportButtons';
import { SparklesIcon, DownloadIcon, LoadingSpinner } from './components/Icon';
import MermaidBlock from './components/MermaidBlock';
import html2canvas from 'html2canvas';
import { LoadingContext } from './components/LoadingContext';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Samples for user to test immediately
const SAMPLE_MARKDOWN_REPORT = `# 2025年人工智能产业分析报告

## 1. 行业概况
人工智能（AI）正在从实验室走向产业化落地。

## 2. 核心公式
模型训练的损失函数通常表示为：
$$
L(\\theta) = -\\frac{1}{N} \\sum_{i=1}^N \\log P(y_i | x_i; \\theta)
$$
其中 $N$ 代表样本总数，$P$ 代表概率分布。

## 3. 业务流程 (Mermaid)
\`\`\`mermaid
graph TD
    A[用户输入] --> B(AI 处理)
    B --> C{是否合规?}
    C -- 是 --> D[生成结果]
    C -- 否 --> E[拒绝请求]
\`\`\`

## 4. 代码示例
这是一个计算斐波那契数列的 Python 脚本：

\`\`\`python
def fibonacci(n):
    if n <= 1:
        return n
    else:
        return fibonacci(n-1) + fibonacci(n-2)

# 打印前10个数字
print([fibonacci(i) for i in range(10)])
\`\`\`

## 5. 关键数据对比
| 公司名称 | 研发投入(亿美元) | 增长率 | 主要方向 |
| :--- | :--- | :--- | :--- |
| **TechCorp** | 150 | 25% | 大语言模型 |
| **DataGen** | 80 | 40% | 图像生成 |

## 6. 结论
未来三年是AI应用爆发的关键窗口期，能量公式 $E=mc^2$ 依然适用。
`;

function App() {
  const [markdown, setMarkdown] = useState('');
  const [debouncedMarkdown, setDebouncedMarkdown] = useState('');
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor'); // For mobile mainly
  const [chartTheme, setChartTheme] = useState<ChartTheme>('default'); // Lifted state
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Loading State
  const [loadingCount, setLoadingCount] = useState(0);

  const loadingContextValue = useMemo(() => ({
    addLoading: () => setLoadingCount(c => c + 1),
    removeLoading: () => setLoadingCount(c => Math.max(0, c - 1)),
  }), []);

  // Debounce Markdown Input
  useEffect(() => {
    if (markdown === debouncedMarkdown) return;
    
    setIsDebouncing(true);
    const handler = setTimeout(() => {
      setDebouncedMarkdown(markdown);
      setIsDebouncing(false);
    }, 500); // 500ms delay for smoother typing and loading indication
    
    return () => clearTimeout(handler);
  }, [markdown, debouncedMarkdown]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    type: 'math' | 'chart' | null;
    target: HTMLElement | null;
  }>({ visible: false, x: 0, y: 0, type: null, target: null });

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setMarkdown(text);
    } catch (err) {
      alert('无法读取剪贴板，请手动粘贴');
    }
  };

  const clearContent = () => {
    setMarkdown('');
  };

  // Close context menu on global click
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu.visible) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu.visible]);

  // Handle right-click on Math formulas and Charts
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const katexElement = target.closest('.katex');
        const mermaidElement = target.closest('.mermaid-container');
        
        if (katexElement || mermaidElement) {
            e.preventDefault();
            e.stopPropagation();
            
            const x = e.clientX;
            const y = e.clientY;

            setContextMenu({
                visible: true,
                x,
                y,
                type: katexElement ? 'math' : 'chart',
                target: (katexElement || mermaidElement) as HTMLElement
            });
        }
    };

    const previewEl = previewRef.current;
    if (previewEl) {
        previewEl.addEventListener('contextmenu', handleContextMenu);
    }

    return () => {
        if (previewEl) {
            previewEl.removeEventListener('contextmenu', handleContextMenu);
        }
    };
  }, []);

  const handleDownloadImage = async () => {
    const { type, target } = contextMenu;
    if (!target) return;

    const triggerDownload = (url: string, prefix: string) => {
        const link = document.createElement('a');
        link.download = `${prefix}-${Date.now()}.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (type === 'math') {
        try {
            const canvas = await html2canvas(target, { 
                backgroundColor: null,
                scale: 3 
            });
            triggerDownload(canvas.toDataURL('image/png'), 'math-formula');
        } catch (err) {
            console.error("Failed to download formula", err);
        }
    } else if (type === 'chart') {
        const svgElement = target.querySelector('svg');
        if (svgElement) {
            try {
                const svgData = new XMLSerializer().serializeToString(svgElement);
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = new Image();
                
                const svgSize = svgElement.getBoundingClientRect();
                canvas.width = svgSize.width * 2; 
                canvas.height = svgSize.height * 2;
                
                img.onload = () => {
                    if (ctx) {
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        triggerDownload(canvas.toDataURL('image/png'), 'mermaid-chart');
                    }
                };
                
                img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
            } catch (err) {
                console.error("Failed to download chart image", err);
            }
        }
    }
    
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const isLoading = isDebouncing || loadingCount > 0;

  return (
    <LoadingContext.Provider value={loadingContextValue}>
      <div className="h-screen flex flex-col bg-slate-50 overflow-hidden relative">
        {/* Context Menu Popup */}
        {contextMenu.visible && (
          <div 
              className="fixed bg-white border border-slate-200 shadow-xl rounded-lg py-1 z-50 min-w-[140px] animate-in fade-in zoom-in-95 duration-100"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()} 
          >
              <button 
                  onClick={handleDownloadImage}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2 transition-colors"
              >
                  <DownloadIcon className="w-4 h-4" />
                  下载{contextMenu.type === 'math' ? '公式' : '图表'}图片
              </button>
          </div>
        )}

        {/* Header with Export Button */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm z-20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <SparklesIcon className="w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">Markdown2Word</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 mr-2">
                <button onClick={() => setMarkdown(SAMPLE_MARKDOWN_REPORT)} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-600 transition">
                  示例
                </button>
                <div className="h-5 w-px bg-slate-300 mx-1"></div>
                <button onClick={clearContent} className="text-xs px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-md transition">
                  清空
                </button>
            </div>
            
            <ExportButtons 
              markdown={markdown} 
              disabled={!markdown.trim() || isLoading} 
              chartTheme={chartTheme}
              setChartTheme={setChartTheme}
              previewId="preview-content"
            />
          </div>
        </header>

        {/* Mobile Navigation Tabs */}
        <div className="md:hidden bg-white border-b border-slate-200 p-2 z-10">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('editor')}
              className={`flex-1 py-1.5 px-4 rounded-md text-sm font-medium transition ${activeTab === 'editor' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
            >
              编辑
            </button>
            <button 
              onClick={() => setActiveTab('preview')}
              className={`flex-1 py-1.5 px-4 rounded-md text-sm font-medium transition ${activeTab === 'preview' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
            >
              预览
            </button>
          </div>
          <div className="flex justify-between items-center mt-2 px-1">
              <button onClick={() => setMarkdown(SAMPLE_MARKDOWN_REPORT)} className="text-xs text-slate-500 hover:text-indigo-600">加载示例</button>
              <button onClick={clearContent} className="text-xs text-slate-400 hover:text-red-500">清空内容</button>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 flex overflow-hidden relative">
          
          {/* Left: Editor */}
          <div className={`flex-1 flex flex-col border-r border-slate-200 bg-white ${activeTab === 'preview' ? 'hidden md:flex' : 'flex'}`}>
            <div className="h-12 px-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Markdown 编辑区</span>
            </div>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="请将 DeepSeek、ChatGPT 或其他 AI 生成的 Markdown 内容粘贴到这里...&#10;&#10;例如：&#10;# 标题&#10;$$ E = mc^2 $$&#10;&#10;```mermaid&#10;graph TD; A-->B;&#10;```"
              className="flex-1 w-full p-6 resize-none outline-none text-slate-700 leading-relaxed editor-textarea text-base"
              spellCheck={false}
            />
          </div>

          {/* Right: Preview */}
          <div className={`flex-1 flex flex-col bg-white relative ${activeTab === 'editor' ? 'hidden md:flex' : 'flex'}`}>
            <div className="h-12 px-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">实时文档预览</span>
                  {isLoading && (
                    <span className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full animate-pulse">
                        <LoadingSpinner className="w-3 h-3" />
                        渲染中...
                    </span>
                  )}
              </div>
              <span className="text-xs text-slate-400 hidden lg:inline">右键公式或图表可下载 PNG</span>
            </div>
            
            <div className="flex-1 overflow-y-auto relative bg-white" ref={previewRef}>
              
              {/* Global Loading Overlay */}
              {isLoading && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-start justify-center pt-20 transition-opacity duration-300">
                      <div className="bg-white shadow-lg border border-slate-200 rounded-full px-4 py-2 flex items-center gap-3">
                          <LoadingSpinner className="w-5 h-5 text-indigo-600" />
                          <span className="text-sm font-medium text-slate-700">正在生成预览...</span>
                      </div>
                  </div>
              )}

              {/* Updated Layout: Full width/height, removed margins/shadows to match Left Editor */}
              <div id="preview-content" className="min-h-full p-8 max-w-none mx-auto text-slate-800 leading-7">
                {debouncedMarkdown ? (
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkMath]} 
                    rehypePlugins={[rehypeKatex]}
                    components={{
                        h1: ({node, ...props}) => <h1 className="text-3xl font-bold text-slate-900 border-b border-slate-200 pb-2 mb-6 mt-2" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-xl font-bold text-slate-800 mt-6 mb-3" {...props} />,
                        h4: ({node, ...props}) => <h4 className="text-lg font-bold text-slate-800 mt-5 mb-2" {...props} />,
                        h5: ({node, ...props}) => <h5 className="text-base font-bold text-slate-800 mt-4 mb-2" {...props} />,
                        h6: ({node, ...props}) => <h6 className="text-sm font-bold text-slate-800 uppercase tracking-wide mt-4 mb-2" {...props} />,
                        p: ({node, ...props}) => <p className="my-3 text-justify" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-extrabold text-slate-900" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-6 my-4 space-y-1" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal pl-6 my-4 space-y-1" {...props} />,
                        li: ({node, ...props}) => <li className="pl-1" {...props} />,
                        table: ({node, ...props}) => <div className="my-6 overflow-x-auto"><table className="min-w-full border-collapse border border-slate-300 text-sm" {...props} /></div>,
                        thead: ({node, ...props}) => <thead className="bg-slate-100" {...props} />,
                        tbody: ({node, ...props}) => <tbody className="bg-white" {...props} />,
                        tr: ({node, ...props}) => <tr className="border-b border-slate-200 hover:bg-slate-50" {...props} />,
                        th: ({node, ...props}) => <th className="border border-slate-300 px-4 py-2 text-left font-bold text-slate-900" {...props} />,
                        td: ({node, ...props}) => <td className="border border-slate-300 px-4 py-2 text-slate-700 align-top" {...props} />,
                        code(props) {
                            const {children, className, node, ref, ...rest} = props; // DESTUCTURE REF to prevent TS Error
                            const match = /language-(\w+)/.exec(className || '');
                            const language = match ? match[1] : '';
                            // @ts-ignore
                            const isInline = props.inline;

                            if (language === 'mermaid') {
                                return <MermaidBlock chart={String(children).replace(/\n$/, '')} theme={chartTheme} />;
                            }

                            if (!isInline && match) {
                              return (
                                <SyntaxHighlighter
                                  {...rest}
                                  children={String(children).replace(/\n$/, '')}
                                  style={oneDark}
                                  language={match[1]}
                                  PreTag="div"
                                  customStyle={{
                                      margin: '1.5rem 0',
                                      borderRadius: '0.5rem',
                                      fontSize: '0.875rem',
                                      lineHeight: '1.5',
                                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                                  }}
                                />
                              );
                            }

                            return isInline ? (
                                <code className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono border border-slate-200 break-words" {...rest}>
                                    {children}
                                </code>
                            ) : (
                                // Fallback for code blocks without language specified
                                <div className="bg-slate-800 rounded-lg p-4 my-4 overflow-x-auto shadow-sm">
                                    <code className="text-slate-50 text-sm font-mono leading-relaxed block whitespace-pre" {...rest}>
                                        {children}
                                    </code>
                                </div>
                            );
                        },
                        blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-500 bg-indigo-50 pl-4 py-2 my-4 italic text-slate-700 rounded-r" {...props} />,
                        hr: ({node, ...props}) => <hr className="my-8 border-slate-200" {...props} />
                    }}
                  >
                    {debouncedMarkdown}
                  </ReactMarkdown>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 min-h-[50vh]">
                    <div className="w-16 h-16 border-4 border-slate-200 border-dashed rounded-xl flex items-center justify-center">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p>在左侧粘贴内容后，此处将显示预览</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </LoadingContext.Provider>
  );
}

export default App;