'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import withSimpleAuth from '../../components/withSimpleAuth';
import { Button } from '@/components/ui/button';
import { DownloadIcon, UploadIcon } from '@/components/property/icons';
import FileUpload from '../../components/property/FileUpload';
import LoadingSpinner from '../../components/property/LoadingSpinner';
import AnalysisDisplay from '../../components/property/AnalysisDisplay';
import FileBrowser, { S3File } from '../../components/property/FileBrowser';
import ReportBrowser from '../../components/property/ReportBrowser';
import UserMenu from '../../components/UserMenu';
import { DocumentAnalysisOutcome } from '../../types/property';
import { useToast } from '@/hooks/use-toast';
import dynamic from 'next/dynamic';

const PdfPreviewModal = dynamic(() => import('../../components/property/PdfPreviewModal'), {
  ssr: false,
});

const AnalysePage: React.FC = () => {
    const [files, setFiles] = useState<S3File[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string>("Select a file to begin.");
    const [error, setError] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<DocumentAnalysisOutcome | null>(null);
    const [isPolling, setIsPolling] = useState(false);
    const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const [reports, setReports] = useState<S3File[]>([]);
    const [selectedReport, setSelectedReport] = useState<string | null>(null);
    const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
    const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
    const [pdfPreview, setPdfPreview] = useState<any | null>(null);
    const [pdfCache, setPdfCache] = useState<Record<string, Promise<any>>>({});

    const handleShowPdfPage = async (sourceFileName: string, pageReference?: string) => {
        try {
            const pdfDoc = await pdfCache[sourceFileName];
            if (!pdfDoc) {
                throw new Error("PDF not pre-loaded. Please select the report again.");
            }
            const pageNumber = pageReference ? parseInt(pageReference.split('-')[0], 10) : 1;
            setPdfPreview({
                pdfDoc,
                initialPage: pageNumber,
                fileName: sourceFileName,
                totalPages: pdfDoc.numPages,
            });
        } catch (error: any) {
            console.error("Failed to show PDF:", error);
            toast({
                title: "Error",
                description: error.message || `Failed to load PDF: ${sourceFileName}`,
                variant: "destructive",
            });
        }
    };

    const fetchFiles = useCallback(async () => {
        try {
            const response = await fetch('/api/list-files', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: 'admin' }), // Static user ID for now
            });
            if (!response.ok) throw new Error('Failed to fetch files');
            const data = await response.json();
            setFiles(data.files);
            setPdfCache({}); // Clear cache on file refresh
        } catch (err) {
            setError('Failed to load your documents.');
        }
    }, []);

    const fetchReports = useCallback(async () => {
        try {
            const response = await fetch('/api/get-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ list: true }),
            });
            if (!response.ok) throw new Error('Failed to fetch reports');
            const data = await response.json();
            setReports(data.reports);
        } catch (err) {
            setError('Failed to load your reports.');
        }
    }, []);

    useEffect(() => {
        fetchFiles();
        fetchReports();
    }, [fetchFiles, fetchReports]);

    const handleUploadSuccess = useCallback(() => {
        fetchFiles(); // Refresh file list after upload
    }, [fetchFiles]);

    const handleFileSelectionChange = useCallback((key: string) => {
        setSelectedFiles(prev => {
            const newSelection = new Set(prev);
            if (newSelection.has(key)) {
                newSelection.delete(key);
            } else {
                newSelection.add(key);
            }
            return newSelection;
        });
    }, []);

    const handleDeleteFile = useCallback(async (key: string) => {
        if (window.confirm('Are you sure you want to delete this file?')) {
            try {
                await fetch('/api/delete-file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key }),
                });
                fetchFiles(); // Refresh file list
            } catch (err) {
                setError('Failed to delete the file.');
            }
        }
    }, [fetchFiles]);

    const handleDeleteReport = useCallback(async (key: string) => {
        if (window.confirm('Are you sure you want to delete this report?')) {
            try {
                await fetch('/api/delete-report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key }),
                });
                fetchReports(); // Refresh report list
            } catch (err) {
                setError('Failed to delete the report.');
            }
        }
    }, [fetchReports]);

    const handleRenameFile = useCallback((key: string, newName: string) => {
        setFiles(prevFiles =>
            prevFiles.map(file =>
                file.key === key ? { ...file, name: newName } : file
            )
        );
    }, []);

    const handleRenameReport = useCallback((key: string, newName: string) => {
        setReports(prevReports =>
            prevReports.map(report =>
                report.key === key ? { ...report, name: newName } : report
            )
        );
    }, []);

    const pollForReport = useCallback(async (analysisId: string) => {
        if (!analysisId) return;
        try {
            const response = await fetch('/api/get-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ analysisId }),
            });
            if (response.status === 404) {
                // Report not ready yet, continue polling
                return;
            }
            if (!response.ok) throw new Error('Failed to get report status');
            const result = await response.json();
            if (result.status === 'COMPLETE') {
                setAnalysisResult(result.report);
                setIsLoading(false);
                setIsPolling(false);
                setCurrentAnalysisId(null);
            }
        } catch (err) {
            setError('Failed to poll for analysis results.');
            setIsLoading(false);
            setIsPolling(false);
            setCurrentAnalysisId(null);
        }
    }, []);

    useEffect(() => {
        if (isPolling && currentAnalysisId) {
            const interval = setInterval(() => pollForReport(currentAnalysisId), 5000);
            return () => clearInterval(interval);
        }
    }, [isPolling, currentAnalysisId, pollForReport]);

    const handleAnalyze = async () => {
        if (selectedFiles.size === 0) {
            setError("Please select at least one file to analyze.");
            return;
        }
        if (selectedFiles.size > 1) {
            setError("Multi-file analysis is not supported yet. Please select only one file.");
            return;
        }

        const keyToAnalyze = Array.from(selectedFiles)[0];

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);
        setLoadingMessage("Starting analysis process...");

        try {
            const response = await fetch('/api/start-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: keyToAnalyze }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to start analysis');
            }

            const { analysisId } = await response.json();
            setCurrentAnalysisId(analysisId);
            setLoadingMessage("Analysis in progress... This may take a few minutes. We'll check for results automatically.");
            setIsPolling(true);
            fetchReports();

        } catch (err: any) {
            setError(err.message || 'An error occurred while starting the analysis.');
            setIsLoading(false);
        }
    };

    const handleDownloadReport = () => {
        if (!analysisResult) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(analysisResult, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "analysis_report.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleLoadReportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const result = JSON.parse(e.target?.result as string);
                    setAnalysisResult(result);
                    setError(null);
                    setIsLoading(false);
                } catch (err) {
                    setError("Failed to parse JSON file.");
                }
            };
            reader.readAsText(file);
        }
    };

    const handleReportSelectionChange = useCallback(async (key: string) => {
        setSelectedReport(key);
        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);
        setLoadingMessage("Loading report...");

        try {
            const reportId = key.split('/').pop()?.replace('.json', '');
            const reportResponse = await fetch('/api/get-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ analysisId: reportId }),
            });
            if (!reportResponse.ok) throw new Error('Failed to get report');
            const result = await reportResponse.json();
            setAnalysisResult(result.report);

            // Pre-load the associated PDF
            const sourceFileName = result.report?.processedDocuments?.[0]?.sourceFileName;
            if (sourceFileName && !pdfCache[sourceFileName]) {
                const file = files.find(f => f.name === sourceFileName);
                if (file && file.url) {
                    const pdfjs = await import('pdfjs-dist');
                    if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
                        pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
                    }
                    const loadingTask = pdfjs.getDocument(file.url).promise;
                    setPdfCache(prevCache => ({ ...prevCache, [sourceFileName]: loadingTask }));
                }
            }
        } catch (err) {
            setError('Failed to load the selected report.');
        } finally {
            setIsLoading(false);
        }
    }, [files, pdfCache, setPdfCache, toast]);

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <header className="flex justify-between items-center p-4 border-b border-gray-700">
                <h1 className="text-xl font-bold">Document Analysis</h1>
                <div className="flex items-center space-x-4">
                    {process.env.NODE_ENV === 'development' && (
                        <>
                            <Button variant="outline" onClick={handleLoadReportClick}>
                                <UploadIcon className="w-4 h-4 mr-2" />
                                Load Report
                            </Button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="application/json"
                            />
                        </>
                    )}
                    <UserMenu />
                </div>
            </header>
            <div className="flex p-4 sm:p-8 gap-4">
                <aside className={`transition-all duration-300 flex-shrink-0 ${isLeftSidebarCollapsed ? 'w-20' : 'w-1/3'}`}>
                    <FileBrowser
                        files={files}
                        selectedFiles={selectedFiles}
                        onFileSelectionChange={handleFileSelectionChange}
                        onDeleteFile={handleDeleteFile}
                        onRenameFile={handleRenameFile}
                        isCollapsed={isLeftSidebarCollapsed}
                        toggleSidebar={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
                    />
                </aside>
                <main className="flex-grow">
                    <section id="file-upload-section" className="mb-8 bg-gray-800 p-6 rounded-lg">
                        <h2 className="text-xl font-semibold text-gray-200 mb-4 text-center">Upload New Document</h2>
                        <FileUpload onUploadSuccess={handleUploadSuccess} disabled={isLoading} />
                    </section>

                    {selectedFiles.size > 0 && !isLoading && (
                        <div className="text-center mb-8">
                            <button
                                onClick={handleAnalyze}
                                className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700"
                            >
                                Analyze {selectedFiles.size} Selected File(s)
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

                    {analysisResult && (
                        <>
                            <div className="text-center mb-4">
                                <Button variant="secondary" onClick={handleDownloadReport}>
                                    <DownloadIcon className="w-4 h-4 mr-2" />
                                    Download Report JSON
                                </Button>
                            </div>
                            <AnalysisDisplay result={analysisResult} onShowPdfPage={handleShowPdfPage} />
                        </>
                    )}
                </main>
                <aside className={`transition-all duration-300 flex-shrink-0 ${isRightSidebarCollapsed ? 'w-20' : 'w-1/3'}`}>
                    <ReportBrowser
                        reports={reports}
                        selectedReport={selectedReport}
                        onReportSelectionChange={handleReportSelectionChange}
                        onDeleteReport={handleDeleteReport}
                        onRenameReport={handleRenameReport}
                        isCollapsed={isRightSidebarCollapsed}
                        toggleSidebar={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
                    />
                </aside>
            </div>
            {pdfPreview && (
                <PdfPreviewModal
                    target={pdfPreview}
                    onClose={() => setPdfPreview(null)}
                />
            )}
        </div>
    );
};

export default withSimpleAuth(AnalysePage);
