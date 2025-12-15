import React, { useState, useRef, useEffect } from 'react';
import { exportToDocx } from '../services/exportService';
import { FileWordIcon, LoadingSpinner } from './Icon';

export type ChartTheme = 'default' | 'neutral' | 'forest' | 'base';
export type MathMode = 'native' | 'image';

interface ExportButtonsProps {
  markdown: string;
  disabled: boolean;
  chartTheme: ChartTheme;
  setChartTheme: (theme: ChartTheme) => void;
  previewId: string; // ID of the DOM element to export as PDF
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ markdown, disabled, chartTheme, setChartTheme, previewId }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [mathMode, setMathMode] = useState<MathMode>('native');
  const settingsRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportWord = async () => {
    if (!markdown) return;
    
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      await new Promise(resolve => setTimeout(resolve, 100)); 
      await exportToDocx(markdown, `document-${timestamp}`, {
          chartTheme,
          mathMode
      });
    } catch (e) {
      console.error("Export failed", e);
      alert("导出失败，请检查网络连接或内容格式");
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * High quality PDF export using Browser Native Print inside an Iframe.
   * This preserves vector fonts (KaTeX) and text selection.
   */
  const handlePrintPdf = async () => {
      const originalElement = document.getElementById(previewId);
      if (!originalElement) {
          alert("无法找到预览内容");
          return;
      }

      setIsExporting(true);
      setShowExportMenu(false);

      try {
          // 1. Create invisible iframe
          const iframe = document.createElement('iframe');
          iframe.style.position = 'fixed';
          iframe.style.right = '0';
          iframe.style.bottom = '0';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = '0';
          document.body.appendChild(iframe);

          const doc = iframe.contentWindow?.document;
          if (!doc) {
              throw new Error("Cannot access iframe document");
          }

          // 2. Gather Styles
          // We need Tailwind (from script in index.html) and KaTeX CSS (from link in index.html)
          const links = document.querySelectorAll('link[rel="stylesheet"]');
          let styleTags = '';
          links.forEach(link => {
              styleTags += link.outerHTML;
          });
          
          // Re-include Tailwind Script to re-process classes in the iframe
          const tailwindScript = '<script src="https://cdn.tailwindcss.com"></script>';

          // 3. Prepare Content
          // Use a print-optimized wrapper
          const contentHtml = originalElement.innerHTML;

          doc.open();
          doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Document Export</title>
                ${styleTags}
                ${tailwindScript}
                <style>
                    body { 
                        margin: 0; 
                        padding: 0; 
                        background: white; 
                    }
                    /* Container styles matching the preview but optimized for A4 */
                    .print-container {
                        max-width: 210mm;
                        margin: 0 auto;
                        padding: 20mm;
                    }
                    /* Print specific adjustments */
                    @media print {
                        @page { margin: 0; }
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="print-container prose max-w-none text-slate-800 leading-7">
                    ${contentHtml}
                </div>
                <script>
                    // Wait for Tailwind and images to load
                    window.onload = function() {
                        // Small buffer for Tailwind to parse classes
                        setTimeout(function() {
                            window.print();
                            // Optional: Removing iframe after print might be tricky as print is blocking/non-blocking depending on browser
                            // We usually leave it or remove it next time
                        }, 800);
                    };
                </script>
            </body>
            </html>
          `);
          doc.close();

      } catch (e) {
          console.error("Print PDF failed", e);
          alert("启动打印服务失败，请重试");
      } finally {
          // We stop the spinner quickly, as the browser print dialog will take over
          setTimeout(() => setIsExporting(false), 1000);
      }
  };

  return (
    <div className="flex items-center gap-2 relative">
      {/* Settings Toggle */}
      <div className="relative" ref={settingsRef}>
        <button
            onClick={() => setShowSettings(!showSettings)}
            disabled={disabled || isExporting}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition disabled:opacity-50"
            title="导出设置"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        </button>

        {showSettings && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 p-4 z-50">
                <h3 className="text-sm font-bold text-slate-800 mb-3">导出设置</h3>
                
                <div className="mb-4">
                    <label className="block text-xs font-medium text-slate-500 mb-1">公式格式 (仅 Word)</label>
                    <select 
                        value={mathMode} 
                        onChange={(e) => setMathMode(e.target.value as MathMode)}
                        className="w-full text-sm border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 p-1.5 border bg-slate-50"
                    >
                        <option value="native">原生公式 (可编辑)</option>
                        <option value="image">图片公式 (更精准)</option>
                    </select>
                </div>

                <div className="mb-4">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Mermaid 图表风格</label>
                    <select 
                        value={chartTheme} 
                        onChange={(e) => setChartTheme(e.target.value as ChartTheme)}
                        className="w-full text-sm border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 p-1.5 border bg-slate-50"
                    >
                        <option value="default">默认 (Default)</option>
                        <option value="neutral">简约 (Neutral)</option>
                        <option value="forest">森林 (Forest)</option>
                        <option value="base">基础 (Base)</option>
                    </select>
                </div>
            </div>
        )}
      </div>

      {/* Split Export Button */}
      <div className="flex rounded-md shadow-sm hover:shadow transition-all relative" ref={exportMenuRef}>
        <button
          onClick={handleExportWord}
          disabled={disabled || isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-l-md border-r border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm whitespace-nowrap"
        >
          {isExporting ? (
            <>
              <LoadingSpinner className="w-4 h-4" />
              <span>导出中...</span>
            </>
          ) : (
            <>
              <FileWordIcon className="w-4 h-4" />
              <span>导出</span>
            </>
          )}
        </button>
        <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={disabled || isExporting}
            className="flex items-center justify-center px-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-r-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        </button>

        {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg border border-slate-200 py-1 z-50">
                <button 
                    onClick={handleExportWord}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2"
                >
                    <FileWordIcon className="w-4 h-4" />
                    导出 Word
                </button>
                <button 
                    onClick={handlePrintPdf}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14 2z"></path>
                        <path d="M10 11l0 6"></path>
                        <path d="M14 11l0 6"></path>
                        <path d="M10 11h4"></path>
                    </svg>
                    导出 PDF
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default ExportButtons;