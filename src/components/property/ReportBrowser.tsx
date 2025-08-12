import React from 'react';
import { S3File } from './FileBrowser';
import { DocumentTextIcon } from './icons';

interface ReportBrowserProps {
  reports: S3File[];
  selectedReport: string | null;
  onReportSelectionChange: (key: string) => void;
}

const ReportBrowser: React.FC<ReportBrowserProps> = ({ reports, selectedReport, onReportSelectionChange }) => {
  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h2 className="text-lg font-semibold mb-4">Analysis Reports</h2>
      {reports.length === 0 ? (
        <p className="text-sm text-gray-400">No reports found.</p>
      ) : (
        <ul>
          {reports.map(report => (
            <li
              key={report.key}
              onClick={() => onReportSelectionChange(report.key)}
              className={`flex items-center p-2 rounded-md cursor-pointer ${
                selectedReport === report.key ? 'bg-blue-600' : 'hover:bg-gray-700'
              }`}
            >
              <DocumentTextIcon className="w-5 h-5 mr-2" />
              <span className="text-sm">{report.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ReportBrowser;
