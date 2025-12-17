import React, { useEffect, useState, useRef } from 'react';
import mermaid from 'mermaid';
import { useLoading } from './LoadingContext';

interface MermaidBlockProps {
  chart: string;
  theme: string;
}

// Global initialization to avoid repeated calls
const initMermaid = (theme: string) => {
  mermaid.initialize({
    startOnLoad: false,
    theme: theme as any,
    securityLevel: 'loose',
    fontFamily: 'sans-serif',
    // suppressErrorRendering removed to fix TS error
  });
};

const MermaidBlock: React.FC<MermaidBlockProps> = ({ chart, theme }) => {
  const { addLoading, removeLoading } = useLoading();
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentThemeRef = useRef(theme);

  useEffect(() => {
    // Only re-init if theme changes
    if (currentThemeRef.current !== theme) {
       initMermaid(theme);
       currentThemeRef.current = theme;
    } else if (!svg) {
        // Init on first load if needed
        initMermaid(theme);
    }
  }, [theme, svg]);

  useEffect(() => {
    let isMounted = true;
    addLoading(); // Signal start

    const renderChart = async () => {
      if (!chart) {
          if (isMounted) removeLoading();
          return;
      }
      
      try {
        if (isMounted) setError(null);

        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        // Use mermaid.render which is async
        const { svg: svgContent } = await mermaid.render(id, chart);
        
        if (isMounted) {
          setSvg(svgContent);
          setError(null);
        }
      } catch (err: any) {
        console.error("Mermaid render error:", err);
        if (isMounted) {
          let msg = "图表渲染失败";
          if (err?.message) {
             if (err.message.includes("Parse error")) {
                 msg = "语法错误：请检查括号是否匹配，或尝试用引号包裹文本 (例如: [\"文本\"])";
             } else {
                 msg = err.message;
             }
          }
          setError(msg);
        }
      } finally {
          if (isMounted) {
              removeLoading(); // Signal end
          }
      }
    };

    renderChart();

    return () => {
      if (isMounted) {
          isMounted = false;
          removeLoading(); // Ensure cleanup if unmounted mid-render
      }
    };
  }, [chart, theme, addLoading, removeLoading]);

  if (error) {
    return (
        <div className="p-4 bg-red-50 border border-red-100 rounded-lg my-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-red-600 font-medium text-sm">
                <span>图表渲染失败: {error}</span>
            </div>
            <pre className="text-xs text-slate-500 overflow-auto">{chart}</pre>
        </div>
    );
  }

  // Use min-height to reduce layout shift before SVG loads
  return (
    <div 
      ref={containerRef}
      className="mermaid-container my-6 flex justify-center bg-white p-4 rounded-lg border border-slate-100 shadow-sm overflow-x-auto cursor-context-menu"
      title="右键点击下载图片"
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{ minHeight: svg ? 'auto' : '100px' }}
    />
  );
};

export default MermaidBlock;