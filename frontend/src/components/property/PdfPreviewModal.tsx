import React, { useEffect, useRef, useState, useCallback } from 'react';
// Import pdfjs-dist using namespace import
import * as pdfjsStarImport from 'pdfjs-dist';
import { XCircleIcon } from './icons'; 

// Access PDF.js types from the star import namespace
type PDFJSGlobalPDFDocumentProxy = pdfjsStarImport.PDFDocumentProxy;
type PDFJSRenderTask = pdfjsStarImport.RenderTask;

// PDF.js worker is configured globally in index.tsx.

interface PdfPreviewModalProps {
  target: {
    pdfDoc: PDFJSGlobalPDFDocumentProxy; 
    initialPage: number;
    fileName: string;
    totalPages: number; 
  } | null;
  onClose: () => void;
}

const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({ target, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const renderTaskRef = useRef<PDFJSRenderTask | null>(null); 
  const [retryAttempt, setRetryAttempt] = useState(0);
  const renderGenerationRef = useRef(0); // Generation counter to prevent race conditions

  useEffect(() => {
    if (target && target.pdfDoc) { 
      const validInitialPage = Math.min(Math.max(1, target.initialPage), target.totalPages);
      setCurrentPage(validInitialPage);
      setError(null);
      setRetryAttempt(0); 
    } else {
      setCurrentPage(1);
      setError(null);
      if (renderTaskRef.current && typeof renderTaskRef.current.cancel === 'function') {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      if (canvasRef.current) {
        const context = canvasRef.current.getContext('2d');
        if (context) {
            context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
    }
  }, [target]);

  const renderPage = useCallback(async () => {
    // Increment generation ID. This helps us know if this render call is the latest one.
    const generation = ++renderGenerationRef.current;

    if (!target || !target.pdfDoc || !canvasRef.current ) { 
      if (canvasRef.current) {
        const context = canvasRef.current.getContext('2d');
        if (context) context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      setIsRenderingPage(false);
      return;
    }
    
    // Cancel any previous, still-running render task.
    if (renderTaskRef.current) {
      await renderTaskRef.current.cancel();
    }

    setIsRenderingPage(true);
    setError(null);
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      setError("Could not get canvas context.");
      setIsRenderingPage(false);
      return;
    }
    
    context.clearRect(0, 0, canvas.width, canvas.height);

    try {
      const page = await target.pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: 1.0 });

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderTask = page.render({ canvasContext: context, viewport: viewport });
      renderTaskRef.current = renderTask;

      await renderTask.promise;

      // SUCCESS: Only update state if this is the latest render request.
      if (generation === renderGenerationRef.current) {
        setIsRenderingPage(false);
        renderTaskRef.current = null;
      }

    } catch (e: any) {
      // ERROR: Only update state if this error is from the latest render request.
      if (generation === renderGenerationRef.current) {
        renderTaskRef.current = null;
        // Don't show an error for cancellations, as they are expected when navigating quickly.
        if (e.name !== 'RenderingCancelledException') {
          console.error(`Error rendering page ${currentPage} of ${target.fileName}:`, e);
          setError(`Failed to render page ${currentPage}: ${e.message || String(e)}`);
          setIsRenderingPage(false);
        }
      }
    }
  }, [target, currentPage]); 

  useEffect(() => {
    if (target && target.pdfDoc) { 
      renderPage();
    }
    
    // The cleanup function is critical to cancel renders when the modal closes or dependencies change.
    return () => {
      if (renderTaskRef.current && typeof renderTaskRef.current.cancel === 'function') {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null; 
      }
    };
  }, [target, currentPage, renderPage, retryAttempt]);


  const goToPrevPage = () => {
    if (currentPage > 1 && !isRenderingPage) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (target && currentPage < target.totalPages && !isRenderingPage) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleRetryRender = () => {
    if (!isRenderingPage) {
        setRetryAttempt(c => c + 1);
    }
  };
  
  if (!target ) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out"
      onClick={onClose} 
      aria-modal="true"
      role="dialog"
      aria-labelledby="pdf-preview-title"
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()} 
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-slate-50">
          <h2 id="pdf-preview-title" className="text-lg font-semibold text-gray-700 truncate" title={target.fileName}>
            Preview: {target.fileName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close PDF preview"
          >
            <XCircleIcon className="w-7 h-7" />
          </button>
        </header>

        <div className="flex-grow overflow-auto p-4 flex items-start justify-center bg-gray-200 relative pt-12">
          {isRenderingPage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-75 z-10">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-sm text-blue-600">Loading page {currentPage}...</p>
            </div>
          )}
          {error && !isRenderingPage && ( 
            <div className="text-center text-red-600 p-4 bg-red-50 rounded-md">
              <p className="font-semibold">Error</p>
              <p className="text-sm">{error}</p>
              <button 
                onClick={handleRetryRender}
                className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:bg-gray-400"
                disabled={isRenderingPage}
              >
                Retry Render
              </button>
            </div>
          )}
          <canvas ref={canvasRef} className={`transition-opacity duration-300 ${isRenderingPage || (error && !isRenderingPage) ? 'opacity-25' : 'opacity-100'}`}></canvas>
        </div>

        <footer className="flex items-center justify-between p-3 border-t border-gray-200 bg-slate-50">
          <button
            onClick={goToPrevPage}
            disabled={currentPage <= 1 || isRenderingPage}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {target.totalPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={currentPage >= target.totalPages || isRenderingPage}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </footer>
      </div>
    </div>
  );
};

export default PdfPreviewModal;
