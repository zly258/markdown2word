import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import ExportButtons, { ChartTheme } from './components/ExportButtons';
import { SparklesIcon, DownloadIcon, LoadingSpinner } from './components/Icon';
import MermaidBlock from './components/MermaidBlock';
import { LoadingContext } from './components/LoadingContext';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/light';
import js from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import ts from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript';
import { atomOneDark as oneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

SyntaxHighlighter.registerLanguage('javascript', js);
SyntaxHighlighter.registerLanguage('typescript', ts);

const App: React.FC = () => {
  const [markdown, setMarkdown] = useState<string>(() => {
    return localStorage.getItem('markdown_content') || '# Markdown to Word Converter\n\nStart typing...';
  });
  const [chartTheme, setChartTheme] = useState<ChartTheme>('default');
  const [loadingCount, setLoadingCount] = useState(0);

  const addLoading = () => setLoadingCount(prev => prev + 1);
  const removeLoading = () => setLoadingCount(prev => Math.max(0, prev - 1));

  useEffect(() => {
    localStorage.setItem('markdown_content', markdown);
  }, [markdown]);

  const components = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';

      if (!inline && language === 'mermaid') {
        return <MermaidBlock chart={String(children).replace(/\n$/, '')} theme={chartTheme} />;
      }

      return !inline && match ? (
        <SyntaxHighlighter
          style={oneDark}
          language={language}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
  };

  return (
    <LoadingContext.Provider value={{ addLoading, removeLoading }}>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-indigo-200 shadow-lg">
              <SparklesIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">Markdown2Word</h1>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Professional Export Tool</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {loadingCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium animate-pulse border border-indigo-100">
                <LoadingSpinner className="w-3 h-3" />
                <span>渲染中...</span>
              </div>
            )}
            <ExportButtons 
              markdown={markdown} 
              disabled={loadingCount > 0} 
              chartTheme={chartTheme} 
              setChartTheme={setChartTheme}
              previewId="preview-content"
            />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex overflow-hidden">
          {/* Editor */}
          <div className="flex-1 flex flex-col border-r border-slate-200 bg-white">
            <div className="h-10 bg-slate-50 border-b border-slate-200 flex items-center px-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Editor</span>
            </div>
            <textarea
              className="flex-1 p-6 resize-none focus:outline-none text-slate-700 font-mono text-sm leading-relaxed"
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="Paste your markdown here..."
            />
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col bg-slate-50">
            <div className="h-10 bg-slate-50 border-b border-slate-200 flex items-center px-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Preview</span>
            </div>
            <div className="flex-1 overflow-auto p-8 flex justify-center">
              <div 
                id="preview-content"
                className="w-full max-w-3xl bg-white shadow-sm border border-slate-200 rounded-xl p-12 min-h-[1000px] prose prose-slate prose-indigo max-w-none"
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={components}
                >
                  {markdown}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </main>
      </div>
    </LoadingContext.Provider>
  );
};

export default App;
