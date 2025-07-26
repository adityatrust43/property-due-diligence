'use client';

import React, { useState, useCallback, useEffect } from 'react';
import withAuth from '../../components/withAuth';
import Header from '../../components/Header';
import FileUpload from '../../components/property/FileUpload';
import AnalysisDisplay from '../../components/property/AnalysisDisplay';
import LoadingSpinner from '../../components/property/LoadingSpinner';
import PdfPreviewModal from '../../components/property/PdfPreviewModal';
import { DocumentAnalysisOutcome, ProcessedDocument, RedFlagItem } from '../../types/property';
import { analyzeDocumentWithGemini } from '../../lib/property/geminiService';
import { DownloadIcon, DocumentTextIcon } from '../../components/property/icons';
import { parseStartPage } from '../../lib/property/pdfUtils';

// Type for the PDF document proxy, will be loaded dynamically
type PDFDocumentProxy = any; 

const AnalysePage: React.FC = () => {
  const [pdfjsLib, setPdfjsLib] = useState<any>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [analysisResult, setAnalysisResult] = useState<DocumentAnalysisOutcome | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("Select PDF file(s) to begin.");
  const [error, setError] = useState<string | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);

  const [previewTarget, setPreviewTarget] =
    useState<{
      pdfDoc: PDFDocumentProxy; 
      initialPage: number;
      fileName: string;
      totalPages: number;
    } | null>(null);

  useEffect(() => {
    // Dynamically import and configure pdfjs-dist
    import('pdfjs-dist/build/pdf.mjs').then(pdfjs => {
      // Dynamically import the worker entry point
      import('pdfjs-dist/build/pdf.worker.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      setPdfjsLib(pdfjs);
    });

    // API key check removed. The error handler in `handleAnalyze` will catch invalid API keys during analysis.
  }, []);


  const handleFilesSelect = useCallback((files: File[]) => {
    setSelectedFiles(files);
    setAnalysisResult(null);
    setError(null);
    if (previewTarget && previewTarget.pdfDoc && typeof previewTarget.pdfDoc.destroy === 'function') {
        previewTarget.pdfDoc.destroy();
        setPreviewTarget(null);
    }
    if (files.length > 0) {
      setLoadingMessage(`Ready to analyze ${files.length} file(s) for document indexing, summarization, title chain, and red flags.`);
    } else {
      setLoadingMessage("Select PDF file(s) to begin.");
    }
  }, [previewTarget]);

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select PDF files first.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    if (previewTarget && previewTarget.pdfDoc && typeof previewTarget.pdfDoc.destroy === 'function') {
        previewTarget.pdfDoc.destroy();
        setPreviewTarget(null);
    }

    setLoadingMessage(`Initiating analysis for ${selectedFiles.length} file(s)...`);

    try {
      const result = await analyzeDocumentWithGemini(selectedFiles, (progressUpdate) => {
        let message = progressUpdate.message || "Processing...";
        if (progressUpdate.type === 'pdfProcessing' && progressUpdate.fileProcessing) {
          const fp = progressUpdate.fileProcessing;
          message = `Extracting pages from ${fp.fileName} (${fp.processed} / ${fp.total})...`;
        } else if (progressUpdate.type === 'gemini') {
            message = progressUpdate.message || `Sending to AI for analysis (indexing, summarization, title chain, red flags)...`;
        }
        setLoadingMessage(message);
      });
      setAnalysisResult(result);
      setLoadingMessage(`Analysis complete for ${selectedFiles.length} file(s).`);
    } catch (err: any) {
      console.error(`Error analyzing files:`, err);
      let detailedError = err.message || "An unexpected error occurred during analysis.";
      if (err.message && err.message.toLowerCase().includes("api key not valid")) {
          setApiKeyMissing(true); 
          detailedError = `Gemini API Key is invalid or not correctly configured. Analysis aborted.`;
      }
      if (err.message && (err.message.includes("Setting up fake worker failed") || err.message.includes("Failed to fetch dynamically imported module") || err.message.includes("GlobalWorkerOptions"))){
          detailedError = `PDF.js library failed to initialize correctly. This might be due to a network issue preventing the PDF worker script from loading, or an internal configuration problem with the PDF library. Please check your internet connection and try refreshing the page. If the problem persists, the PDF viewing/processing functionality may be impaired. Original Error: ${err.message}`;
      }
      setError(`Error during analysis: ${detailedError}`);
      setLoadingMessage(`Analysis failed.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowPdfPage = useCallback(async (sourceFileName: string, pageReference?: string) => {
    if (!pdfjsLib) {
      setError("PDF library is not loaded yet. Please wait a moment and try again.");
      return;
    }

    const fileToPreview = selectedFiles.find(f => f.name === sourceFileName);
    if (!fileToPreview) {
      console.error(`File "${sourceFileName}" not found in selected files.`);
      setError(`Could not find the document "${sourceFileName}" to preview.`);
      return;
    }

    if (previewTarget && previewTarget.pdfDoc && typeof previewTarget.pdfDoc.destroy === 'function') {
        await previewTarget.pdfDoc.destroy();
    }
    setLoadingMessage(`Loading preview for ${sourceFileName}...`);
    setIsLoading(true); 

    try {
      const arrayBuffer = await fileToPreview.arrayBuffer();
      const pdfDoc: PDFDocumentProxy = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdfDoc.numPages;
      let initialPageNum = parseStartPage(pageReference);
      initialPageNum = Math.min(Math.max(1, initialPageNum), totalPages);

      setPreviewTarget({ pdfDoc, initialPage: initialPageNum, fileName: sourceFileName, totalPages });
      setError(null);
    } catch (e: any) {
        console.error(`Error loading PDF "${sourceFileName}" for preview:`, e);
        let previewError = e.message || "Unknown error loading PDF."
        if (e.message && (e.message.includes("Setting up fake worker failed") || e.message.includes("Failed to fetch dynamically imported module") || e.message.includes("GlobalWorkerOptions"))){
          previewError = `PDF.js library failed to initialize correctly for preview. This might be due to a network issue preventing the PDF worker script from loading, or an internal configuration problem with the PDF library. Please check your internet connection and try refreshing the page. Original Error: ${e.message}`;
        }
        setError(`Could not load PDF "${sourceFileName}" for preview: ${previewError}`);
        if (previewTarget && previewTarget.pdfDoc && typeof previewTarget.pdfDoc.destroy === 'function') {
             await previewTarget.pdfDoc.destroy();
             setPreviewTarget(null);
        }
    } finally {
        setIsLoading(false); 
        setLoadingMessage(analysisResult ? `Analysis complete for ${selectedFiles.length} file(s).` : `Ready to analyze ${selectedFiles.length} file(s) for document indexing, summarization, title chain, and red flags.`);
    }
  }, [selectedFiles, previewTarget, analysisResult]);

  const handleClosePreviewModal = useCallback(async () => {
    if (previewTarget && previewTarget.pdfDoc && typeof previewTarget.pdfDoc.destroy === 'function') {
      await previewTarget.pdfDoc.destroy();
      setPreviewTarget(null);
    }
  }, [previewTarget]);


  const handleExportToPDF = () => {
    if (analysisResult && analysisResult.inputFiles.length > 0) {
        const fileNames = analysisResult.inputFiles.map(f => f.name).join(', ');
        const totalPagesCombined = analysisResult.inputFiles.reduce((sum, f) => sum + f.totalPages, 0);

        const printWindow = window.open('', '_blank');
        if(printWindow) {
            printWindow.document.write('<html><head><title>Property Document Analysis Report</title>');
            printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>'); 
            printWindow.document.write('<style>body { padding: 20px; font-family: Inter, sans-serif; } @page { size: A4; margin: 20mm; } .noprint, .pdf-preview-trigger, button { display: none !important; } h1, h2, h3 { margin-bottom: 0.5em; } .summary-content { white-space: pre-wrap; word-break: break-word; background-color: #f9fafb; padding: 10px; border: 1px solid #e5e7eb; border-radius: 4px; margin-top: 5px;} table { border-collapse: collapse; width: 100%; margin-top: 0.5em; margin-bottom: 1em; font-size: 0.9em;} th, td { border: 1px solid #ddd; padding: 6px; text-align: left;} th { background-color: #f2f2f2;} .report-section { margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid #ccc; } .report-section:last-child { border-bottom: none; } .section-item { margin-bottom:15px; padding-bottom:10px; border-bottom:1px dashed #eee; } .section-item:last-child { border-bottom:none; } </style>');
            printWindow.document.write('</head><body>');
            printWindow.document.write(`<h1>Property Document Analysis Report</h1>`);
            printWindow.document.write(`<p><strong>Documents Analyzed:</strong> ${fileNames}</p>`);
            printWindow.document.write(`<p><strong>Total Pages Processed:</strong> ${totalPagesCombined} (from ${analysisResult.inputFiles.length} files)</p><hr style="margin: 20px 0;"/>`);

            // Title Chain Section
            if (analysisResult.titleChainEvents && analysisResult.titleChainEvents.length > 0) {
                printWindow.document.write(`<div class="report-section"><h2>Title Chain / Ownership Sequence</h2>`);
                analysisResult.titleChainEvents
                  .sort((a,b) => a.order - b.order)
                  .forEach(event => {
                    printWindow.document.write(`<div class="section-item">`);
                    printWindow.document.write(`<p style="font-size: 0.9em; color: #1000;">`);
                    printWindow.document.write(`<strong>Date:</strong> ${event.date}<br/>`);
                    printWindow.document.write(`<strong>Document Type:</strong> ${event.documentType}<br/>`);
                    printWindow.document.write(`<strong>Transferor:</strong> ${event.transferor}<br/>`);
                    printWindow.document.write(`<strong>Transferee:</strong> ${event.transferee}<br/>`);
                    if(event.propertyDescription) printWindow.document.write(`<strong>Property:</strong> ${event.propertyDescription}<br/>`);
                    printWindow.document.write(`<strong>Summary:</strong> ${event.summaryOfTransaction}`);
                    printWindow.document.write(`</p></div>`);
                });
                 printWindow.document.write(`</div>`);
            }

            // Indexed Documents Section
            if (analysisResult.processedDocuments.length > 0) {
                printWindow.document.write(`<div class="report-section"><h2>Indexed Documents & Detailed Explanations</h2>`);
                analysisResult.processedDocuments
                  .sort((a,b) => a.originalImageIndex - b.originalImageIndex)
                  .forEach(doc => {
                    printWindow.document.write(`<div class="section-item">`);
                    printWindow.document.write(`<h3>${doc.documentType}</h3>`);
                    printWindow.document.write(`<p style="font-size: 0.9em; color: #1000;">`);
                    if (analysisResult.inputFiles.length > 1) printWindow.document.write(`<strong>Source File:</strong> ${doc.sourceFileName}<br/>`);
                    if (doc.pageRangeInSourceFile) printWindow.document.write(`<strong>Page Range:</strong> ${doc.pageRangeInSourceFile}<br/>`);
                    if (doc.date) printWindow.document.write(`<strong>Date:</strong> ${doc.date}<br/>`);
                    if (doc.partiesInvolved) printWindow.document.write(`<strong>Parties:</strong> ${doc.partiesInvolved}<br/>`);
                    printWindow.document.write(`<strong>Status:</strong> ${doc.status}`);
                    if (doc.status === 'Unsupported' && doc.unsupportedReason) printWindow.document.write(` (${doc.unsupportedReason})`);
                    printWindow.document.write(`</p>`);
                    
                    let summaryHtml = doc.summary.replace(/\n/g, '<br/>');
                    summaryHtml = summaryHtml.replace(/\|\s*([^|\n]+)\s*\|\s*([^|\n]+)\s*\|/g, '<tr><td>$1</td><td>$2</td></tr>'); 
                    summaryHtml = summaryHtml.replace(/\|\s*([^|\n]+)\s*\|\s*([^|\n]+)\s*\|\s*([^|\n]+)\s*\|/g, '<tr><td>$1</td><td>$2</td><td>$3</td></tr>'); 
                    summaryHtml = summaryHtml.replace(/(\<tr\>.+?\<\/tr\>)/g, (match) => {
                        const headerCells = match.matchAll(/\<td\>(.*?)\<\/td\>/g);
                        let header = '<tr>';
                        for (const cell of headerCells) {
                            // Basic heuristic for header row (if it looks like a header)
                            if (cell[1].toLowerCase().includes('item') || cell[1].toLowerCase().includes('description') || cell[1].toLowerCase().includes('value') || cell[1].toLowerCase().includes('name') || cell[1].toLowerCase().includes('date') || cell[1].toLowerCase().includes('amount')) {
                                header += `<th>${cell[1]}</th>`;
                            } else {
                                 header += `<th>Value</th>`; 
                            }
                        }
                        // This logic is flawed for creating headers on the fly from content.
                        // Simplified: Assume first row of a detected table is header if it doesn't look like a typical data row.
                        // For export, it's better to just render the table as is.
                        // The regex above will just create <tr><td>...</td></tr>. A more robust solution is needed for full markdown table to HTML.
                        // For now, this is a very basic attempt.
                        return `<table><tbody>${match}</tbody></table>`; // Simplified: just wrap in table.
                    });
                    
                    printWindow.document.write(`<p><strong>Detailed Summary:</strong></p><div class="summary-content">${summaryHtml}</div>`);
                    printWindow.document.write(`</div>`);
                });
                printWindow.document.write(`</div>`);
            }
            
            // Red Flags Section
            if (analysisResult.redFlags && analysisResult.redFlags.length > 0) {
                printWindow.document.write(`<div class="report-section"><h2>Potential Red Flags & Suggestions</h2>`);
                analysisResult.redFlags.forEach(flag => {
                    printWindow.document.write(`<div class="section-item" style="border-left: 5px solid ${flag.severity === 'High' ? 'red' : flag.severity === 'Medium' ? 'orange' : 'blue'}; padding-left: 10px;">`);
                    printWindow.document.write(`<h3 style="color: ${flag.severity === 'High' ? 'red' : flag.severity === 'Medium' ? 'orange' : 'blue'};">Severity: ${flag.severity}</h3>`);
                    printWindow.document.write(`<p><strong>Description:</strong> ${flag.description}</p>`);
                    printWindow.document.write(`<p><strong>Suggestion:</strong> ${flag.suggestion}</p>`);
                    if (flag.relatedDocumentIds && flag.relatedDocumentIds.length > 0) {
                        printWindow.document.write(`<p><strong>Related Documents:</strong></p><ul>`);
                        flag.relatedDocumentIds.forEach(docId => {
                            const doc = analysisResult.processedDocuments.find(d => d.documentId === docId);
                            if (doc) {
                                printWindow.document.write(`<li>${doc.documentType} (from ${doc.sourceFileName}, ${doc.pageRangeInSourceFile || 'N/A'})</li>`);
                            } else {
                                printWindow.document.write(`<li>Unknown Document (${docId})</li>`);
                            }
                        });
                        printWindow.document.write(`</ul>`);
                    }
                    printWindow.document.write(`</div>`);
                });
                printWindow.document.write(`</div>`);
            } else if (analysisResult.redFlags) { // If redFlags array exists but is empty
                 printWindow.document.write(`<div class="report-section"><h2>Potential Red Flags & Suggestions</h2><p>No significant red flags were automatically identified.</p></div>`);
            }


            // Unsupported Pages Section
            if (analysisResult.unsupportedPages.length > 0) {
                 printWindow.document.write(`<div class="report-section"><h2>Unprocessed Pages</h2><ul>`);
                 analysisResult.unsupportedPages.forEach(page => {
                     printWindow.document.write(`<li>`);
                     if (analysisResult.inputFiles.length > 1) printWindow.document.write(`<strong>File:</strong> ${page.sourceFileName}, `);
                     printWindow.document.write(`<strong>Page:</strong> ${page.pageNumberInSourceFile} - <em>Reason:</em> ${page.reason}`);
                     printWindow.document.write(`</li>`);
                 });
                 printWindow.document.write(`</ul></div>`);
            }

            printWindow.document.write('</body></html>');
            printWindow.document.close();

            setTimeout(() => {
                printWindow.print();
            }, 750); 
        } else {
            alert("Could not open print window. Please check your browser's pop-up settings.");
        }
    } else {
        alert("No analysis content to export.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-8">
      <Header />

      <main className="w-full max-w-5xl bg-gray-800 shadow-xl rounded-xl p-6 sm:p-10">
        <section id="file-upload-section" className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-200 mb-2 text-center">Upload Document(s)</h2>
          <p className="text-center text-gray-400 mb-6">
            Select or drag & drop your PDF(s). All uploaded files will be processed together.
            <br />
            <span className="text-xs">
              Note: Processing very large PDFs (e.g., 100+ pages combined) entirely in the browser can be slow and resource-intensive.
            </span>
          </p>
          <FileUpload onFilesSelect={handleFilesSelect} disabled={isLoading && loadingMessage.startsWith("Initiating")} />
        </section>

        {selectedFiles.length > 0 && (
          <div className="text-center mb-8">
            <button
              onClick={handleAnalyze}
              disabled={isLoading || selectedFiles.length === 0}
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              aria-live="polite"
            >
              {isLoading ? loadingMessage : (selectedFiles.length > 0 ? `Analyze ${selectedFiles.length} File(s)` : "Analyze")}
            </button>
          </div>
        )}

        {isLoading && (
          <div className="my-10 flex flex-col items-center justify-center">
            <LoadingSpinner />
            <p className="text-sm text-gray-400 mt-2 text-center">{loadingMessage}</p>
          </div>
        )}

        {error && (
          <div className="my-6 p-4 bg-red-900 border border-red-700 text-red-300 rounded-md">
            <p className="font-semibold text-center">Application Error</p>
            <p className="text-sm text-center">{error}</p>
          </div>
        )}

        {analysisResult && !isLoading && (
          <div className="my-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6">
                <div className="mb-4 sm:mb-0">
                    <h2 className="text-3xl font-semibold text-blue-400">Analysis Report</h2>
                    <p className="text-sm text-gray-400">
                        Files Analyzed: {analysisResult.inputFiles.map(f => f.name).join(', ')}
                        <br/>
                        Total Pages Processed: {analysisResult.inputFiles.reduce((sum, f) => sum + f.totalPages, 0)} from {analysisResult.inputFiles.length} file(s).
                    </p>
                </div>
                <button
                    onClick={handleExportToPDF}
                    className="flex items-center self-start sm:self-center px-4 py-2 bg-gray-600 text-white font-medium rounded-lg shadow hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 noprint"
                >
                    <DownloadIcon className="w-5 h-5 mr-2" />
                    Export Report
                </button>
            </div>
             <div id="analysis-report-content">
                <AnalysisDisplay result={analysisResult} onShowPdfPage={handleShowPdfPage} />
             </div>
          </div>
        )}
      </main>

      <footer className="w-full max-w-5xl mt-12 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} Document Analyzer. For informational purposes only.</p>
        <p>This tool provides automated document indexing, summarization, title chain, and red flag analysis. Always verify critical information.</p>
      </footer>

      {previewTarget && (
        <PdfPreviewModal
          target={previewTarget}
          onClose={handleClosePreviewModal}
        />
      )}
    </div>
  );
};

export default withAuth(AnalysePage);
