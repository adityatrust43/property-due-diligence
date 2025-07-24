
import React from 'react';

interface ReportSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const ReportSection: React.FC<ReportSectionProps> = ({ title, icon, children }) => {
  return (
    <div className="bg-white shadow-lg rounded-xl p-6 mb-8 transition-all duration-300 ease-in-out hover:shadow-xl">
      <div className="flex items-center mb-4 pb-2 border-b border-gray-200">
        {icon && <span className="mr-3 text-blue-600">{icon}</span>}
        <h2 className="text-2xl font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="text-gray-700 prose prose-sm max-w-none">
        {children}
      </div>
    </div>
  );
};

export default ReportSection;
