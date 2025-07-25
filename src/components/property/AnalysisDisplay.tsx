import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DocumentAnalysisOutcome, ProcessedDocument, TitleChainEvent, RedFlagItem, UnsupportedPage, PropertySummary } from '../../types/property';
import { formatDate } from '../../lib/utils';
import ReportSection from './ReportSection';
import {
  DocumentTextIcon, EyeIcon, CheckCircleIcon, WarningIcon, QuestionMarkCircleIcon,
  ListChecksIcon, LinkIcon, AlertTriangleIcon, InformationCircleIcon, UserCircleIcon, HomeIcon
} from './icons';

interface AnalysisDisplayProps {
  result: DocumentAnalysisOutcome;
  onShowPdfPage: (sourceFileName: string, pageReference?: string) => void;
}

const getStatusIcon = (status: ProcessedDocument['status']) => {
  switch (status) {
    case 'Processed':
      return <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0" />;
    case 'Unsupported':
       return <WarningIcon className="w-5 h-5 text-yellow-400 flex-shrink-0" />;
    default:
      return <QuestionMarkCircleIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />;
  }
};

const PdfLink: React.FC<{fileName: string, pageRef?: string, onShowPdfPage: AnalysisDisplayProps['onShowPdfPage'], children: React.ReactNode, className?: string}> =
  ({fileName, pageRef, onShowPdfPage, children, className}) => (
  <button
    onClick={() => onShowPdfPage(fileName, pageRef)}
    className={`pdf-preview-trigger text-blue-400 hover:text-blue-300 hover:underline focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-sm p-0.5 inline-flex items-center ${className || ''}`}
    title={`View page ${pageRef || '1'} of ${fileName}`}
    aria-label={`View document ${fileName} at page ${pageRef || '1'}`}
  >
    {children}
    <EyeIcon className="w-4 h-4 ml-1 flex-shrink-0" />
  </button>
);

const FormattedSummary: React.FC<{ summaryText: string }> = ({ summaryText }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      h1: ({node, ...props}) => <h1 className="text-xl font-bold my-4" {...props} />,
      h2: ({node, ...props}) => <h2 className="text-lg font-bold my-3" {...props} />,
      h3: ({node, ...props}) => <h3 className="text-md font-bold my-2" {...props} />,
      p: ({node, ...props}) => <p className="my-2" {...props} />,
      ul: ({node, ...props}) => <ul className="list-disc list-inside my-2 pl-4" {...props} />,
      ol: ({node, ...props}) => <ol className="list-decimal list-inside my-2 pl-4" {...props} />,
      li: ({node, ...props}) => <li className="my-1" {...props} />,
      strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
      table: ({node, ...props}) => <div className="overflow-x-auto my-4"><table className="min-w-full border-collapse" {...props} /></div>,
      thead: ({node, ...props}) => <thead className="border-b border-gray-600" {...props} />,
      th: ({node, ...props}) => <th className="px-3 py-2 text-left text-xs font-semibold text-gray-200 bg-gray-700 border border-gray-600" {...props} />,
      tbody: ({node, ...props}) => <tbody className="bg-gray-800" {...props} />,
      tr: ({node, ...props}) => <tr className="border-b border-gray-700" {...props} />,
      td: ({node, ...props}) => <td className="px-3 py-2 text-sm text-gray-300 border border-gray-600 whitespace-normal break-words" {...props} />,
    }}
  >
    {summaryText}
  </ReactMarkdown>
);


const ProcessedDocumentCard: React.FC<{ doc: ProcessedDocument; onShowPdfPage: AnalysisDisplayProps['onShowPdfPage']; isMultiFile: boolean }> = ({ doc, onShowPdfPage, isMultiFile }) => {
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false); // Default to collapsed

  return (
    <li className="bg-gray-800 shadow-lg rounded-xl p-6 mb-6 transition-all duration-300 ease-in-out hover:shadow-xl">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start">
          <span className="mr-3 pt-1">{getStatusIcon(doc.status)}</span>
          <div>
            <h3 className="text-xl font-semibold text-blue-400">{doc.documentType}</h3>
            <div className="text-xs text-gray-400 mt-0.5 space-x-2">
              {isMultiFile && doc.sourceFileName && (
                <span className="font-medium text-indigo-400">File: {doc.sourceFileName}</span>
              )}
              {doc.pageRangeInSourceFile && (
                <span>Pages: {doc.pageRangeInSourceFile}</span>
              )}
               {doc.date && (
                <span>Date: {formatDate(doc.date)}</span>
              )}
            </div>
             {doc.pageRangeInSourceFile && (
                 <PdfLink fileName={doc.sourceFileName} pageRef={doc.pageRangeInSourceFile} onShowPdfPage={onShowPdfPage} className="text-sm mt-1">
                    View Original Pages
                 </PdfLink>
             )}
          </div>
        </div>
         <span className={`text-xs font-medium px-2 py-1 rounded-full border ${doc.status === 'Processed' ? 'bg-green-900 text-green-300 border-green-700' : 'bg-yellow-900 text-yellow-300 border-yellow-700'}`}>
            {doc.status}
        </span>
      </div>

      {doc.partiesInvolved && (
        <p className="text-sm text-gray-400 mb-2 ml-8"><span className="font-medium">Parties:</span> {doc.partiesInvolved}</p>
      )}

      {doc.status === 'Unsupported' && doc.unsupportedReason && (
        <p className="text-sm text-yellow-300 bg-yellow-900 bg-opacity-50 p-2 rounded-md mb-3 ml-8">{doc.unsupportedReason}</p>
      )}

      {doc.summary && (
        <div className="ml-8">
          <button
            onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
            className="text-sm text-blue-400 hover:text-blue-300 font-medium mb-2 focus:outline-none flex items-center"
            aria-expanded={isSummaryExpanded}
            aria-controls={`summary-content-${doc.documentId}`}
          >
            {isSummaryExpanded ? 'Hide Detailed Summary' : 'Show Detailed Summary'}
            <span className={`ml-1.5 inline-block transform transition-transform duration-200 text-xs ${isSummaryExpanded ? 'rotate-180' : 'rotate-0'}`}>▼</span>
          </button>
          {isSummaryExpanded && (
            <div
              id={`summary-content-${doc.documentId}`}
              className="prose prose-sm max-w-none text-gray-300 bg-gray-900 p-4 rounded-md border border-gray-700"
            >
              <FormattedSummary summaryText={doc.summary} />
            </div>
          )}
        </div>
      )}
    </li>
  );
};

interface TitleChainEventCardProps {
  event: TitleChainEvent;
  onShowPdfPage: AnalysisDisplayProps['onShowPdfPage'];
  findDocumentById: (docId: string) => ProcessedDocument | undefined;
}

const TitleChainEventCard: React.FC<TitleChainEventCardProps> = ({ event, onShowPdfPage, findDocumentById }) => {
  const relatedDoc = event.relatedDocumentId ? findDocumentById(event.relatedDocumentId) : undefined;
  return (
    <div className="bg-gray-800 border border-gray-700 shadow-md rounded-lg p-4 relative">
      <div className="absolute -left-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold ring-4 ring-gray-900">
        {event.order + 1}
      </div>
      <div className="ml-6">
        <p className="text-sm text-gray-400 mb-1">
            <span className="font-semibold text-blue-400">{formatDate(event.date)}</span> - <span className="italic">{event.documentType}</span>
        </p>
        <div className="space-y-1 text-sm text-gray-300">
          <p><strong className="text-gray-200">From (Transferor):</strong> {event.transferor}</p>
          <p><strong className="text-gray-200">To (Transferee):</strong> {event.transferee}</p>
          {event.propertyDescription && <p><strong className="text-gray-200">Property:</strong> {event.propertyDescription}</p>}
          <p className="mt-1"><strong className="text-gray-200">Transaction Summary:</strong> {event.summaryOfTransaction}</p>
        </div>
        {relatedDoc && (
          <div className="mt-2">
             <PdfLink
                fileName={relatedDoc.sourceFileName}
                pageRef={relatedDoc.pageRangeInSourceFile}
                onShowPdfPage={onShowPdfPage}
                className="text-xs"
             >
                View Related Document ({relatedDoc.documentType})
            </PdfLink>
          </div>
        )}
      </div>
    </div>
  );
};

const getSeverityStyles = (severity: RedFlagItem['severity']): { icon: React.ReactNode, bgColor: string, textColor: string, borderColor: string, titleColor: string } => {
  switch (severity) {
    case 'High':
      return { icon: <AlertTriangleIcon className="w-5 h-5 text-red-400" />, bgColor: 'bg-red-900 bg-opacity-30', textColor: 'text-red-300', borderColor: 'border-red-600', titleColor: 'text-red-400' };
    case 'Medium':
      return { icon: <WarningIcon className="w-5 h-5 text-orange-400" />, bgColor: 'bg-orange-900 bg-opacity-30', textColor: 'text-orange-300', borderColor: 'border-orange-600', titleColor: 'text-orange-400' };
    case 'Low':
      return { icon: <InformationCircleIcon className="w-5 h-5 text-blue-400" />, bgColor: 'bg-blue-900 bg-opacity-30', textColor: 'text-blue-300', borderColor: 'border-blue-600', titleColor: 'text-blue-400' };
    default:
      return { icon: <QuestionMarkCircleIcon className="w-5 h-5 text-gray-400" />, bgColor: 'bg-gray-700', textColor: 'text-gray-300', borderColor: 'border-gray-600', titleColor: 'text-gray-300' };
  }
};

const RedFlagCard: React.FC<{ flag: RedFlagItem; onShowPdfPage: AnalysisDisplayProps['onShowPdfPage']; findDocumentById: (docId: string) => ProcessedDocument | undefined; isMultiFile: boolean }> = ({ flag, onShowPdfPage, findDocumentById, isMultiFile }) => {
  const severityStyles = getSeverityStyles(flag.severity);

  return (
    <li className={`shadow-lg rounded-xl p-5 mb-6 border-l-4 ${severityStyles.borderColor} ${severityStyles.bgColor} transition-all duration-300 ease-in-out hover:shadow-xl`}>
      <div className="flex items-start mb-2">
        <span className="mr-3 pt-0.5">{severityStyles.icon}</span>
        <h3 className={`text-lg font-semibold ${severityStyles.titleColor}`}>Potential Red Flag: {flag.severity} Severity</h3>
      </div>
      <div className="ml-8 space-y-2">
        <p className={`text-sm ${severityStyles.textColor}`}><strong className="font-medium">Issue:</strong> {flag.description}</p>
        <p className={`text-sm ${severityStyles.textColor} bg-opacity-50 p-2 rounded-md ${severityStyles.bgColor === 'bg-red-900 bg-opacity-30' ? 'bg-red-800 bg-opacity-20' : severityStyles.bgColor === 'bg-orange-900 bg-opacity-30' ? 'bg-orange-800 bg-opacity-20' : 'bg-blue-800 bg-opacity-20' }`}><strong className="font-medium">Suggestion:</strong> {flag.suggestion}</p>
        {flag.relatedDocumentIds && flag.relatedDocumentIds.length > 0 && (
          <div>
            <p className={`text-xs font-medium ${severityStyles.textColor} mb-1`}>Related Document(s):</p>
            <ul className="list-disc list-inside pl-2 space-y-1">
              {flag.relatedDocumentIds.map(docId => {
                const doc = findDocumentById(docId);
                if (!doc) return <li key={docId} className="text-xs text-gray-500">Unknown Document ({docId})</li>;
                return (
                  <li key={docId} className="text-xs">
                    <PdfLink
                      fileName={doc.sourceFileName}
                      pageRef={doc.pageRangeInSourceFile}
                      onShowPdfPage={onShowPdfPage}
                      className={`${severityStyles.textColor} hover:opacity-80`}
                    >
                      {doc.documentType}
                      {isMultiFile && ` (from ${doc.sourceFileName})`}
                      {doc.pageRangeInSourceFile && `, ${doc.pageRangeInSourceFile}`}
                    </PdfLink>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </li>
  );
};

const PropertySummaryCard: React.FC<{ summary: PropertySummary }> = ({ summary }) => (
  <ReportSection title="Overall Property Summary" icon={<HomeIcon className="w-7 h-7" />}>
    <div className="bg-gray-800 shadow-lg rounded-xl p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Owner */}
        <div className="flex items-start">
          <UserCircleIcon className="w-8 h-8 text-blue-400 mr-4 flex-shrink-0" />
          <div>
            <h3 className="text-md font-semibold text-gray-400 uppercase tracking-wider">Current Owner</h3>
            <p className="text-xl font-bold text-white">{summary.currentOwner}</p>
          </div>
        </div>

        {/* Property Brief */}
        <div className="flex items-start">
          <DocumentTextIcon className="w-8 h-8 text-blue-400 mr-4 flex-shrink-0" />
          <div>
            <h3 className="text-md font-semibold text-gray-400 uppercase tracking-wider">Property Brief</h3>
            <p className="text-base text-gray-300">{summary.propertyBrief}</p>
          </div>
        </div>
      </div>
    </div>
  </ReportSection>
);


const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ result, onShowPdfPage }) => {
  const isMultiFile = result.inputFiles && result.inputFiles.length > 1;

  const findDocumentById = (docId: string): ProcessedDocument | undefined => {
    return result.processedDocuments.find((d: ProcessedDocument) => d.documentId === docId);
  };

  return (
    <div className="space-y-10 mt-8" id="analysis-report-content-inner">
      {result.propertySummary && <PropertySummaryCard summary={result.propertySummary} />}

      {result.titleChainEvents && result.titleChainEvents.length > 0 && (
        <ReportSection title="Title Chain / Ownership Sequence" icon={<LinkIcon className="w-7 h-7" />}>
          <div className="space-y-6 relative pl-3">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-700 ml-[0.3rem]"></div>
            {result.titleChainEvents
              .sort((a: TitleChainEvent, b: TitleChainEvent) => a.order - b.order)
              .map((event: TitleChainEvent) => (
                <TitleChainEventCard
                  key={event.eventId}
                  event={event}
                  onShowPdfPage={onShowPdfPage}
                  findDocumentById={findDocumentById}
                />
            ))}
          </div>
        </ReportSection>
      )}

      <ReportSection title="Indexed Documents & Detailed Explanations" icon={<ListChecksIcon className="w-7 h-7" />}>
        {result.processedDocuments.length === 0 && (
          <p className="text-gray-400">No distinct documents were identified or explained from the provided file(s).</p>
        )}
        <ul className="space-y-4">
          {result.processedDocuments
            .sort((a: ProcessedDocument, b: ProcessedDocument) => {
              if (a.date && b.date) {
                return new Date(a.date).getTime() - new Date(b.date).getTime();
              }
              if (a.date) {
                return -1;
              }
              if (b.date) {
                return 1;
              }
              return a.originalImageIndex - b.originalImageIndex;
            })
            .map((doc: ProcessedDocument) => (
              <ProcessedDocumentCard key={doc.documentId} doc={doc} onShowPdfPage={onShowPdfPage} isMultiFile={isMultiFile} />
          ))}
        </ul>
      </ReportSection>

      {result.redFlags && result.redFlags.length > 0 && (
        <ReportSection title="Potential Red Flags & Suggestions" icon={<AlertTriangleIcon className="w-7 h-7 text-red-400" />}>
           <p className="mb-4 text-sm text-gray-400">
            The AI has identified the following potential areas of concern or items requiring further attention. These are based on common due diligence criteria and the information present in the documents.
          </p>
          <ul className="space-y-4">
            {result.redFlags.map((flag: RedFlagItem) => (
              <RedFlagCard
                key={flag.redFlagId}
                flag={flag}
                onShowPdfPage={onShowPdfPage}
                findDocumentById={findDocumentById}
                isMultiFile={isMultiFile}
              />
            ))}
          </ul>
        </ReportSection>
      )}

      {result.redFlags && result.redFlags.length === 0 && (
         <ReportSection title="Potential Red Flags & Suggestions" icon={<CheckCircleIcon className="w-7 h-7 text-green-400" />}>
            <p className="text-gray-400">No significant red flags were automatically identified by the AI based on the provided documents. However, always conduct a thorough manual review.</p>
        </ReportSection>
      )}


      {result.unsupportedPages.length > 0 && (
        <ReportSection title="Unprocessed Pages" icon={<QuestionMarkCircleIcon className="w-7 h-7" />}>
          <p className="mb-3 text-sm text-gray-400">
            Some pages could not be processed or were not part of an identifiable document:
          </p>
          <ul className="list-disc list-inside space-y-2 pl-2">
            {result.unsupportedPages.map((page: UnsupportedPage, index: number) => (
              <li key={`${page.sourceFileName}-${page.pageNumberInSourceFile}-${index}`} className="text-sm text-gray-300">
                {isMultiFile && page.sourceFileName ? `${page.sourceFileName}, ` : ''}
                Page {page.pageNumberInSourceFile}: <span className="text-yellow-400">{page.reason}</span>
                {page.sourceFileName && (
                  <PdfLink fileName={page.sourceFileName} pageRef={page.pageNumberInSourceFile} onShowPdfPage={onShowPdfPage} className="ml-1 text-xs">
                    (View Page)
                  </PdfLink>
                )}
              </li>
            ))}
          </ul>
        </ReportSection>
      )}
    </div>
  );
};

export default AnalysisDisplay;
