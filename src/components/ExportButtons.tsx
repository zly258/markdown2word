import React, { useState, useRef, useEffect } from 'react';
import { exportToDocx } from '../utils/exportService';
import { FileWordIcon, LoadingSpinner } from './Icon';

// 图表主题类型
export type ChartTheme = 'default' | 'neutral' | 'forest' | 'base';

// 导出按钮属性接口
interface ExportButtonsProps {
  markdown: string;
  disabled: boolean;
  chartTheme: ChartTheme;
  setChartTheme: (theme: ChartTheme) => void;
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ markdown, disabled, chartTheme, setChartTheme }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // 处理点击外部区域关闭设置面板
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 复制功能已移除

  // 处理Word导出
  const handleExportWord = async () => {
    if (!markdown) return;
    
    setIsExporting(true);
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      await new Promise(resolve => setTimeout(resolve, 100)); 
      await exportToDocx(markdown, `document-${timestamp}`, {
          chartTheme
      });
    } catch (e) {
      console.error("导出失败", e);
      alert("导出失败，请检查内容格式");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2 relative">
      

      {/* 设置按钮 */}
      <div className="relative" ref={settingsRef}>
        <button
            onClick={() => setShowSettings(!showSettings)}
            disabled={disabled || isExporting}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-md transition disabled:opacity-50 border border-transparent hover:border-slate-200"
            title="导出设置"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0 .73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        </button>

        {showSettings && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 p-4 z-50">
                <h3 className="text-sm font-bold text-slate-800 mb-3">导出设置</h3>
                
                <div className="mb-4">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Mermaid 图表风格</label>
                    <select 
                        value={chartTheme} 
                        onChange={(e) => setChartTheme(e.target.value as ChartTheme)}
                        className="w-full text-sm border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-1.5 border bg-slate-50"
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

      {/* 导出按钮 */}
      <button
        onClick={handleExportWord}
        disabled={disabled || isExporting}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm whitespace-nowrap"
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
    </div>
  );
};

export default ExportButtons;
