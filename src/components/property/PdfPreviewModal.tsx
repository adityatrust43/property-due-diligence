import React, { useEffect, useRef, useState, useCallback } from 'react';
// Import pdfjs-dist using namespace import
import * as pdfjsStarImport from 'pdfjs-dist';
import { XCircleIcon, RotateIcon, ZoomInIcon, ZoomOutIcon, RotateLeftIcon } from './icons';

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
  const [pageTransforms, setPageTransforms] = useState<Map<number, { rotation: number; scale: number }>>(new Map());
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const renderTaskRef = useRef<PDFJSRenderTask | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const renderGenerationRef = useRef(0);

  const getPageTransform = useCallback((pageNumber: number) => {
    return pageTransforms.get(pageNumber) || { rotation: 0, scale: 0.9 };
  }, [pageTransforms]);

  useEffect(() => {
    if (target && target.pdfDoc) {
      const validInitialPage = Math.min(Math.max(1, target.initialPage), target.totalPages);
      setCurrentPage(validInitialPage);
      setPageTransforms(new Map());
      setError(null);
      setRetryAttempt(0);
    } else {
      setCurrentPage(1);
      setError(null);
      if (renderTaskRef.current) {
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
    const generation = ++renderGenerationRef.current;

    if (!target || !target.pdfDoc || !canvasRef.current) {
      if (canvasRef.current) {
        const context = canvasRef.current.getContext('2d');
        if (context) context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      setIsRenderingPage(false);
      return;
    }

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
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
      const { rotation, scale } = getPageTransform(currentPage);
      const viewport = page.getViewport({ scale, rotation });

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderTask = page.render({ canvasContext: context, viewport });
      renderTaskRef.current = renderTask;

      await renderTask.promise;

      if (generation === renderGenerationRef.current) {
        setIsRenderingPage(false);
        renderTaskRef.current = null;
      }
    } catch (e: any) {
      if (generation === renderGenerationRef.current) {
        renderTaskRef.current = null;
        if (e.name !== 'RenderingCancelledException') {
          console.error(`Error rendering page ${currentPage} of ${target.fileName}:`, e);
          setError(`Failed to render page ${currentPage}: ${e.message || String(e)}`);
          setIsRenderingPage(false);
        }
      }
    }
  }, [target, currentPage, getPageTransform]);

  useEffect(() => {
    if (target && target.pdfDoc) {
      renderPage();
    }
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [target, currentPage, renderPage, retryAttempt, pageTransforms]);


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

  const handleRotate = (clockwise: boolean) => {
    const currentTransform = getPageTransform(currentPage);
    const newRotation = clockwise
      ? (currentTransform.rotation + 90) % 360
      : (currentTransform.rotation - 90 + 360) % 360;
    setPageTransforms(new Map(pageTransforms).set(currentPage, { ...currentTransform, rotation: newRotation }));
  };

  const handleZoom = (zoomIn: boolean) => {
    const currentTransform = getPageTransform(currentPage);
    const newScale = zoomIn ? currentTransform.scale * 1.2 : currentTransform.scale / 1.2;
    setPageTransforms(new Map(pageTransforms).set(currentPage, { ...currentTransform, scale: newScale }));
  };

  if (!target) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out"
      onClick={onClose} 
      aria-modal="true"
      role="dialog"
      aria-labelledby="pdf-preview-title"
    >
      <div 
        className="bg-gray-800 text-white rounded-lg shadow-xl w-full max-w-4xl h-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()} 
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900">
          <h2 id="pdf-preview-title" className="text-lg font-semibold text-gray-200 truncate" title={target.fileName}>
            Preview: {target.fileName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close PDF preview"
          >
            <XCircleIcon className="w-7 h-7" />
          </button>
        </header>

        <div className="flex-grow overflow-auto p-4 flex items-start justify-center bg-gray-700 relative pt-12">
          {isRenderingPage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800 bg-opacity-75 z-10">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-400"></div>
              <p className="mt-2 text-sm text-blue-300">Loading page {currentPage}...</p>
            </div>
          )}
          {error && !isRenderingPage && ( 
            <div className="text-center text-red-300 p-4 bg-red-900 bg-opacity-50 rounded-md">
              <p className="font-semibold">Error</p>
              <p className="text-sm">{error}</p>
              <button 
                onClick={handleRetryRender}
                className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-500"
                disabled={isRenderingPage}
              >
                Retry Render
              </button>
            </div>
          )}
          <canvas key={`${target.fileName}-${currentPage}`} ref={canvasRef} className={`transition-opacity duration-300 ${isRenderingPage || (error && !isRenderingPage) ? 'opacity-25' : 'opacity-100'}`}></canvas>
        </div>

        <footer className="flex items-center justify-between p-3 border-t border-gray-700 bg-gray-900">
          <button
            onClick={goToPrevPage}
            disabled={currentPage <= 1 || isRenderingPage}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <div className="flex items-center justify-center flex-grow space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleZoom(false)}
                disabled={isRenderingPage}
                className="p-2 text-sm font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
                title="Zoom Out"
              >
                <ZoomOutIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleZoom(true)}
                disabled={isRenderingPage}
                className="p-2 text-sm font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
                title="Zoom In"
              >
                <ZoomInIcon className="w-5 h-5" />
              </button>
            </div>
            <span className="text-sm text-gray-300 px-2">
              Page {currentPage} of {target.totalPages}
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleRotate(false)}
                disabled={isRenderingPage}
                className="p-2 text-sm font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
                title="Rotate Left"
              >
                <RotateLeftIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleRotate(true)}
                disabled={isRenderingPage}
                className="p-2 text-sm font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
                title="Rotate Right"
              >
                <RotateIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          <button
            onClick={goToNextPage}
            disabled={currentPage >= target.totalPages || isRenderingPage}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </footer>
      </div>
    </div>
  );
};

export default PdfPreviewModal;
