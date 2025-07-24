
import React, { useState, useCallback } from 'react';
import { UploadIcon, FilePdfIcon } from './icons';

interface FileUploadProps {
  onFilesSelect: (files: File[]) => void; // Changed from onFileSelect
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelect, disabled }) => {
  const [fileNames, setFileNames] = useState<string[]>([]); // Changed from fileName

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const validPDFFiles = Array.from(files).filter(f => f.type === "application/pdf");
      if (validPDFFiles.length > 0) {
        setFileNames(validPDFFiles.map(f => f.name));
        onFilesSelect(validPDFFiles);
      } else {
        setFileNames([]);
        onFilesSelect([]); // Notify parent of no valid files
        alert("Please select PDF file(s). No valid PDFs found in selection.");
      }
    } else {
      setFileNames([]);
      onFilesSelect([]);
    }
  }, [onFilesSelect]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      const validPDFFiles = Array.from(files).filter(f => f.type === "application/pdf");
       if (validPDFFiles.length > 0) {
        setFileNames(validPDFFiles.map(f => f.name));
        onFilesSelect(validPDFFiles);
      } else {
        setFileNames([]);
        onFilesSelect([]);
        alert("Please drop PDF file(s). No valid PDFs found in dropped items.");
      }
    } else {
      setFileNames([]);
      onFilesSelect([]);
    }
  }, [onFilesSelect, disabled]);

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };
  
  const handleDragEnter = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <label
        htmlFor="pdf-upload"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        className={`flex flex-col items-center justify-center w-full h-auto min-h-[16rem] border-2 border-dashed rounded-lg cursor-pointer transition-colors p-4
                    ${disabled ? 'bg-gray-200 border-gray-300 cursor-not-allowed' : 'bg-slate-50 hover:bg-slate-100 border-gray-300 hover:border-blue-500'}`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
          {fileNames.length > 0 ? (
            <>
              <FilePdfIcon className="w-10 h-10 mb-3 text-blue-600" />
              <p className="mb-1 text-sm text-gray-700">
                <span className="font-semibold">{fileNames.length} PDF file(s) selected</span>
              </p>
              <ul className="text-xs text-gray-500 list-none max-h-28 overflow-y-auto px-2 space-y-1">
                {fileNames.map(name => <li key={name} className="truncate" title={name}>{name}</li>)}
              </ul>
              <p className="mt-2 text-xs text-gray-500">Click to change or drag and drop other PDF(s)</p>
            </>
          ) : (
            <>
              <UploadIcon className="w-10 h-10 mb-3 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">PDF documents only (max 50MB per file)</p>
            </>
          )}
        </div>
        <input
          id="pdf-upload"
          type="file"
          className="hidden"
          accept=".pdf"
          multiple // Allow multiple files
          onChange={handleFileChange}
          disabled={disabled}
        />
      </label>
    </div>
  );
};

export default FileUpload;
