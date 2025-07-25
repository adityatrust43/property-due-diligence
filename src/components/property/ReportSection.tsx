
import React from 'react';

interface ReportSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const ReportSection: React.FC<ReportSectionProps> = ({ title, icon, children }) => {
  return (
    <div className="bg-gray-800 shadow-lg rounded-xl p-6 mb-8 transition-all duration-300 ease-in-out hover:shadow-xl">
      <div className="flex items-center mb-4 pb-2 border-b border-gray-700">
        {icon && <span className="mr-3 text-blue-400">{icon}</span>}
        <h2 className="text-2xl font-semibold text-gray-200">{title}</h2>
      </div>
      <div className="text-gray-300 prose prose-sm max-w-none">
        {children}
      </div>
    </div>
  );
};

export default ReportSection;
