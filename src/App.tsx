import React, { useState, useEffect, useRef } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import ExportButtons from './components/ExportButtons';
import { SparklesIcon } from './components/Icon';

const App: React.FC = () => {
  // 定义统一的 LaTeX 清洗函数，解决转义字符导致的渲染问题
  const cleanMathText = (text: string) => {
    if (!text) return text;
    return text
      .replace(/\\(\$\$?)/g, '$1')           // 还原公式边界: \$ -> $, \$$ -> $$
      .replace(/\\([__{}])/g, '$1')          // 还原特殊字符: \_ -> _, \{ -> { 等
      .replace(/\\\\([a-zA-Z]+)/g, '\\$1')   // 还原命令: \\frac -> \frac
      .replace(/&amp;/g, '&');               // 还原 HTML 实体
  };

  const [markdown, setMarkdown] = useState<string>(() => {
    const saved = localStorage.getItem('markdown_content') || '# Markdown 转 Word 转换器\n\n在此输入内容...';
    return cleanMathText(saved);
  });
  const [vditor, setVditor] = useState<Vditor>();
  const vditorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!vditorRef.current) return;

    let vditorInstance: Vditor;
    
    // 初始化 Vditor
    vditorInstance = new Vditor(vditorRef.current, {
      height: '100%',
      value: markdown,
      mode: 'ir', // 即时渲染模式
      placeholder: '在此输入 Markdown 内容...',
      theme: 'classic',
      icon: 'ant',
      toolbarConfig: {
        hide: true,
      },
      toolbar: [], // 隐藏工具栏
      lang: 'zh_CN', // 显式指定语言
      // 使用默认 CDN，确保 KaTeX 资源正确加载
      cache: {
        enable: false,
      },
      preview: {
        actions: [],
        maxWidth: 1000,
        math: {
          engine: 'KaTeX',
          inlineDigit: true,
        },
        markdown: {
          codeBlockPreview: true,
          mathBlockPreview: true,
          sanitize: true,
        },
      },
      input: (value) => {
        // 实时清洗内容，确保即时渲染正确
        if (value.includes('\\')) {
          const processedValue = cleanMathText(value);
          setMarkdown(processedValue);
        } else {
          setMarkdown(value);
        }
      },
      after: () => {
        setVditor(vditorInstance);
      },
    });

    return () => {
      // 销毁实例前进行安全检查
      if (vditorInstance) {
        try {
          // 仅在 vditor 对象及其内部元素存在时尝试销毁
          // @ts-ignore
          if (vditorInstance.vditor && vditorInstance.vditor.element) {
            vditorInstance.destroy();
          }
        } catch (e) {
          // 忽略 StrictMode 导致的重复销毁错误
        }
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('markdown_content', markdown);
  }, [markdown]);

  const handleClear = () => {
    setMarkdown('');
    if (vditor) {
      vditor.setValue('');
    }
  };

  return (
    <div className="h-screen bg-white flex flex-col">
      {/* 顶部导航栏 */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-blue-200 shadow-lg">
            <SparklesIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Markdown2Word</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">全能所见即所得编辑器</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <ExportButtons 
            markdown={markdown} 
            disabled={!vditor} 
            onClear={handleClear}
          />
        </div>
      </header>

      {/* 编辑器区域 */}
      <main className="flex-1 overflow-hidden">
        <div ref={vditorRef} id="vditor" className="h-full" />
      </main>
    </div>
  );
};

export default App;
