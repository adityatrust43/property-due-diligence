import React, { useState } from 'react';
import { S3File } from './FileBrowser';
import { DocumentTextIcon, TrashIcon, EditIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';

interface ReportBrowserProps {
    reports: S3File[];
    selectedReport: string | null;
    onReportSelectionChange: (key: string) => void;
    onDeleteReport: (key: string) => void;
    onRenameReport: (key: string, newName: string) => void;
    isCollapsed: boolean;
    toggleSidebar: () => void;
}

const ReportBrowser: React.FC<ReportBrowserProps> = ({ reports, selectedReport, onReportSelectionChange, onDeleteReport, onRenameReport, isCollapsed, toggleSidebar }) => {
    const [renamingKey, setRenamingKey] = useState<string | null>(null);
    const [newName, setNewName] = useState('');

    const handleDeleteClick = (e: React.MouseEvent, key: string) => {
        e.stopPropagation();
        onDeleteReport(key);
    };

    const handleRenameClick = (e: React.MouseEvent, key: string, currentName: string) => {
        e.stopPropagation();
        setRenamingKey(key);
        setNewName(currentName);
    };

    const handleRenameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewName(e.target.value);
    };

    const handleRenameSubmit = (key: string) => {
        if (newName.trim()) {
            onRenameReport(key, newName.trim());
        }
        setRenamingKey(null);
        setNewName('');
    };

    return (
        <div className="bg-gray-800 p-4 rounded-lg h-full">
            <div className="flex justify-between items-center mb-4">
                {!isCollapsed && <h2 className="text-lg font-semibold">Your Reports</h2>}
                <button onClick={toggleSidebar} className="text-gray-400 hover:text-white">
                    {isCollapsed ? <ChevronLeftIcon className="w-5 h-5" /> : <ChevronRightIcon className="w-5 h-5" />}
                </button>
            </div>
            {isCollapsed && (
                <div className="flex justify-center items-start h-full pt-8">
                    <h3 className="text-lg font-semibold text-white transform rotate-90">Your Reports</h3>
                </div>
            )}
            {!isCollapsed && (
                <>
                    {reports.length === 0 ? (
                        <p className="text-sm text-gray-400">No reports found.</p>
                    ) : (
                        <ul>
                    {reports.map(report => (
                        <li
                            key={report.key}
                            onClick={() => onReportSelectionChange(report.key)}
                            className={`flex items-center justify-between p-2 rounded-md cursor-pointer ${selectedReport === report.key ? 'bg-blue-600' : 'hover:bg-gray-700'
                                }`}
                        >
                            <div className="flex items-center">
                                <DocumentTextIcon className="w-5 h-5 mr-2" />
                                {renamingKey === report.key ? (
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={handleRenameChange}
                                        onBlur={() => handleRenameSubmit(report.key)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit(report.key)}
                                        className="bg-gray-900 text-white p-1 rounded"
                                        autoFocus
                                    />
                                ) : (
                                    <span className="text-sm">{report.name}</span>
                                )}
                            </div>
                            <div className="flex items-center">
                                <button
                                    onClick={(e) => handleRenameClick(e, report.key, report.name)}
                                    className="p-1 text-gray-400 hover:text-white mr-2"
                                    title="Rename report"
                                >
                                    <EditIcon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={(e) => handleDeleteClick(e, report.key)}
                                    className="p-1 text-gray-400 hover:text-white"
                                    title="Delete report"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
                    )}
                </>
            )}
        </div>
    );
};

export default ReportBrowser;
