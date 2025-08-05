'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { UploadIcon, FilePdfIcon } from './icons';

interface FileUploadProps {
  onUploadSuccess: (key: string) => void;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess, disabled }) => {
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, { processed: number; total: number; message: string }>>({});
  const [pdfjsLib, setPdfjsLib] = useState<any>(null);

  useEffect(() => {
    // Dynamically import and configure pdfjs-dist
    import('pdfjs-dist/build/pdf.mjs').then(pdfjs => {
      // Dynamically import the worker entry point
      import('pdfjs-dist/build/pdf.worker.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      setPdfjsLib(pdfjs);
    });
  }, []);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const validPDFFiles = Array.from(files).filter(f => f.type === "application/pdf");
    if (validPDFFiles.length === 0) {
      alert("Please select PDF file(s).");
      return;
    }

    setFileNames(validPDFFiles.map(f => f.name));
    setUploadProgress({});

    for (const file of validPDFFiles) {
      try {
        setUploadProgress(prev => ({ ...prev, [file.name]: { processed: 0, total: 0, message: 'Loading PDF...' } }));

        const fileBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
        const numPages = pdf.numPages;
        const images: Blob[] = [];

        setUploadProgress(prev => ({ ...prev, [file.name]: { processed: 0, total: numPages, message: `Converting page 1 of ${numPages}...` } }));

        for (let i = 1; i <= numPages; i++) {
          setUploadProgress(prev => ({ ...prev, [file.name]: { processed: i, total: numPages, message: `Converting page ${i} of ${numPages}...` } }));
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (!context) {
            throw new Error('Could not get canvas context');
          }

          await page.render({ canvasContext: context, viewport: viewport }).promise;
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
          images.push(blob as Blob);
        }

        setUploadProgress(prev => ({ ...prev, [file.name]: { processed: numPages, total: numPages, message: 'Getting upload URL...' } }));

        // Get presigned URL for the PDF
        const presignedUrlResponse = await fetch('/api/get-presigned-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: file.name, fileType: file.type }),
        });

        if (!presignedUrlResponse.ok) {
            throw new Error('Failed to get presigned URL');
        }

        const { signedUrl, key } = await presignedUrlResponse.json();

        // Upload the PDF directly to S3
        setUploadProgress(prev => ({ ...prev, [file.name]: { processed: numPages, total: numPages, message: 'Uploading PDF...' } }));
        const pdfUploadResponse = await fetch(signedUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type },
        });

        if (!pdfUploadResponse.ok) {
            throw new Error('PDF upload to S3 failed');
        }

        // Upload the images to our server
        setUploadProgress(prev => ({ ...prev, [file.name]: { processed: numPages, total: numPages, message: 'Uploading images...' } }));
        const formData = new FormData();
        formData.append('key', key);
        images.forEach((image, index) => {
          formData.append('images', image, `page_${index + 1}.png`);
        });

        const imageUploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!imageUploadResponse.ok) {
          throw new Error('Image upload failed');
        }

        setUploadProgress(prev => ({ ...prev, [file.name]: { processed: numPages, total: numPages, message: 'Complete' } }));
        console.log(`Successfully uploaded ${file.name}. S3 Key: ${key}`);
        onUploadSuccess(key);
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        alert(`Error uploading ${file.name}. Please try again.`);
        setUploadProgress(prev => ({ ...prev, [file.name]: { processed: 0, total: 0, message: 'Error' } }));
      }
    }
  }, [onUploadSuccess, pdfjsLib]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
  }, [handleFiles]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    handleFiles(event.dataTransfer.files);
  }, [disabled, handleFiles]);

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <label
        htmlFor="pdf-upload"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`flex flex-col items-center justify-center w-full h-auto min-h-[16rem] border-2 border-dashed rounded-lg cursor-pointer transition-colors p-4
                    ${disabled ? 'bg-gray-700 border-gray-600 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 border-gray-500 hover:border-blue-500'}`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
          {fileNames.length > 0 ? (
            <>
              <FilePdfIcon className="w-10 h-10 mb-3 text-blue-500" />
              <p className="mb-1 text-sm text-gray-300">
                <span className="font-semibold">Uploading {fileNames.length} PDF file(s)</span>
              </p>
              <ul className="text-xs text-gray-400 list-none max-h-28 overflow-y-auto px-2 space-y-1">
                {fileNames.map(name => {
                  const progress = uploadProgress[name];
                  if (progress && progress.message === 'Complete') {
                    return (
                      <li key={name} className="truncate" title={name}>
                        {name} - Complete
                      </li>
                    );
                  }
                  const progressText = progress ? `${progress.message}` : 'Waiting...';
                  return (
                    <li key={name} className="truncate" title={name}>
                      {name} - {progress ? progressText : 'Waiting...'}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <>
              <UploadIcon className="w-10 h-10 mb-3 text-gray-500" />
              <p className="mb-2 text-gray-400">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">PDF documents only</p>
            </>
          )}
        </div>
        <input
          id="pdf-upload"
          type="file"
          className="hidden"
          accept=".pdf"
          multiple
          onChange={handleFileChange}
          disabled={disabled}
        />
      </label>
    </div>
  );
};

export default FileUpload;
