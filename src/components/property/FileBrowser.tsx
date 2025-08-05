import React from 'react';
import { FilePdfIcon, TrashIcon } from './icons';

export interface S3File {
    key: string;
    name: string;
    size: number;
    lastModified: Date;
}

interface FileBrowserProps {
    files: S3File[];
    selectedFiles: Set<string>;
    onFileSelectionChange: (key: string) => void;
    onDeleteFile: (key: string) => void;
}

const FileBrowser: React.FC<FileBrowserProps> = ({ files, selectedFiles, onFileSelectionChange, onDeleteFile }) => {
    return (
        <div className="bg-gray-800 p-4 rounded-lg h-full">
            <h3 className="text-lg font-semibold text-white mb-4">Your Documents</h3>
            <ul className="space-y-2">
                {files.map(file => (
                    <li key={file.key} className="flex items-center justify-between bg-gray-700 p-2 rounded-md">
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                checked={selectedFiles.has(file.key)}
                                onChange={() => onFileSelectionChange(file.key)}
                                className="mr-2"
                            />
                            <FilePdfIcon className="w-6 h-6 text-red-400 mr-2" />
                            <div>
                                <p className="text-sm font-medium text-white">{file.name}</p>
                                <p className="text-xs text-gray-400">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            </div>
                        </div>
                        <button onClick={() => onDeleteFile(file.key)} className="text-gray-400 hover:text-red-500">
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default FileBrowser;
