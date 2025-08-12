import React, { useState } from 'react';
import { FilePdfIcon, TrashIcon, EditIcon } from './icons';

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
    onRenameFile: (key: string, newName: string) => void;
}

const FileBrowser: React.FC<FileBrowserProps> = ({ files, selectedFiles, onFileSelectionChange, onDeleteFile, onRenameFile }) => {
    const [renamingKey, setRenamingKey] = useState<string | null>(null);
    const [newName, setNewName] = useState('');

    const handleRenameClick = (key: string, currentName: string) => {
        setRenamingKey(key);
        setNewName(currentName);
    };

    const handleRenameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewName(e.target.value);
    };

    const handleRenameSubmit = (key: string) => {
        if (newName.trim()) {
            onRenameFile(key, newName.trim());
        }
        setRenamingKey(null);
        setNewName('');
    };

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
                                {renamingKey === file.key ? (
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={handleRenameChange}
                                        onBlur={() => handleRenameSubmit(file.key)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit(file.key)}
                                        className="bg-gray-900 text-white p-1 rounded"
                                        autoFocus
                                    />
                                ) : (
                                    <p className="text-sm font-medium text-white">{file.name}</p>
                                )}
                                <p className="text-xs text-gray-400">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center">
                            <button onClick={() => handleRenameClick(file.key, file.name)} className="text-gray-400 hover:text-white mr-2">
                                <EditIcon className="w-5 h-5" />
                            </button>
                            <button onClick={() => onDeleteFile(file.key)} className="text-gray-400 hover:text-red-500">
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default FileBrowser;
