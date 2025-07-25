
import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-400"></div>
      <p className="text-blue-400 font-medium">Analyzing Document...</p>
    </div>
  );
};

export default LoadingSpinner;
