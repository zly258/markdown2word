import React, { useState, useRef, useEffect } from 'react';
import { exportToDocx } from '../services/exportService';
import { FileWordIcon, LoadingSpinner } from './Icon';
// @ts-ignore
import html2pdf from 'html2pdf.js';

export type ChartTheme = 'default' | 'neutral' | 'forest' | 'base';
export type MathMode = 'editable' | 'image';

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
  const [mathMode, setMathMode] = useState<MathMode>('editable'); // Restore Math Mode state
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
          mathMode // Pass the user selection
      });
    } catch (e) {
      console.error("Export failed", e);
      alert("导出失败，请检查内容格式");
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Direct PDF Export using html2pdf.js
   * Bypasses browser print dialog and downloads file directly.
   */
  const handleExportPdf = async () => {
      const element = document.getElementById(previewId);
      if (!element) {
          alert("无法找到预览内容");
          return;
      }

      setIsExporting(true);
      setShowExportMenu(false);

      // Give UI a moment to update state
      await new Promise(resolve => setTimeout(resolve, 500));

      const opt = {
        margin:       [15, 15, 15, 15], // top, left, bottom, right in mm
        filename:     `markdown2word-${new Date().toISOString().slice(0, 10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
            scale: 2, // 2x scale for Retina-like sharpness
            useCORS: true, 
            letterRendering: true,
            scrollY: 0,
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        // 'avoid-all' tries to avoid breaking images/containers across pages
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
      };

      try {
          await html2pdf().set(opt).from(element).save();
      } catch (e) {
          console.error("PDF Export failed", e);
          alert("PDF 导出失败，请重试");
      } finally {
          setIsExporting(false);
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
                    <label className="block text-xs font-medium text-slate-500 mb-1">Word 公式格式</label>
                    <div className="flex bg-slate-100 p-1 rounded-md">
                        <button 
                            onClick={() => setMathMode('editable')}
                            className={`flex-1 py-1 text-xs rounded transition ${mathMode === 'editable' ? 'bg-white shadow text-indigo-600 font-medium' : 'text-slate-500'}`}
                        >
                            可编辑
                        </button>
                        <button 
                            onClick={() => setMathMode('image')}
                            className={`flex-1 py-1 text-xs rounded transition ${mathMode === 'image' ? 'bg-white shadow text-indigo-600 font-medium' : 'text-slate-500'}`}
                        >
                            高清图片
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                        {mathMode === 'editable' ? '使用 Word 原生公式，可修改但可能存在少许兼容问题' : '转换为图片插入，显示完美但不可编辑'}
                    </p>
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
                    onClick={handleExportPdf}
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