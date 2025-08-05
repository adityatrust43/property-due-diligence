'use client';

import React, { useState, useCallback, useEffect } from 'react';
import withSimpleAuth from '../../components/withSimpleAuth';
import FileUpload from '../../components/property/FileUpload';
import LoadingSpinner from '../../components/property/LoadingSpinner';
import AnalysisDisplay from '../../components/property/AnalysisDisplay';
import FileBrowser, { S3File } from '../../components/property/FileBrowser';
import UserMenu from '../../components/UserMenu';
import { DocumentAnalysisOutcome } from '../../types/property';

const AnalysePage: React.FC = () => {
    const [files, setFiles] = useState<S3File[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string>("Select a file to begin.");
    const [error, setError] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<DocumentAnalysisOutcome | null>(null);
    const [isPolling, setIsPolling] = useState(false);
    const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);

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
        } catch (err) {
            setError('Failed to load your documents.');
        }
    }, []);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

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

        } catch (err: any) {
            setError(err.message || 'An error occurred while starting the analysis.');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <header className="flex justify-between items-center p-4 border-b border-gray-700">
                <h1 className="text-xl font-bold">Document Analysis</h1>
                <UserMenu />
            </header>
            <div className="flex p-4 sm:p-8">
                <aside className="w-1/4">
                    <FileBrowser
                        files={files}
                    selectedFiles={selectedFiles}
                    onFileSelectionChange={handleFileSelectionChange}
                    onDeleteFile={handleDeleteFile}
                />
                </aside>
                <main className="w-3/4 ml-8">
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
                        <AnalysisDisplay result={analysisResult} onShowPdfPage={() => {}} />
                    )}
                </main>
            </div>
        </div>
    );
};

export default withSimpleAuth(AnalysePage);
