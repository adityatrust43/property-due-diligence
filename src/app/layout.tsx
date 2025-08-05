import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "../components/ui/toaster";
import AmplifyProvider from '../components/AmplifyProvider';
import ConfigureAmplifyClientSide from '../components/ConfigureAmplify';

export const metadata: Metadata = {
  title: 'Property Diligence AI',
  description: 'A chat interface for Google Gemini API.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <AmplifyProvider>
          <ConfigureAmplifyClientSide />
          {children}
        </AmplifyProvider>
        <Toaster />
      </body>
    </html>
  );
}
