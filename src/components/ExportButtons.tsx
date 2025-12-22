import React, { useState } from 'react';
import { exportToDocx } from '../utils/exportService';
import { FileWordIcon, LoadingSpinner } from './Icon';

interface ExportButtonsProps {
  markdown: string;
  disabled: boolean;
  onClear: () => void;
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ markdown, disabled, onClear }) => {
  const [isExporting, setIsExporting] = useState(false);

  // 处理Word导出
  const handleExportWord = async () => {
    if (!markdown) return;
    
    setIsExporting(true);
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      await new Promise(resolve => setTimeout(resolve, 100)); 
      await exportToDocx(markdown, `document-${timestamp}`);
    } catch (e) {
      console.error("导出失败", e);
      alert("导出失败，请检查内容格式");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2 relative">
      <button
        onClick={onClear}
        disabled={disabled || isExporting}
        className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm whitespace-nowrap border border-slate-200"
      >
        <span>清空</span>
      </button>

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
