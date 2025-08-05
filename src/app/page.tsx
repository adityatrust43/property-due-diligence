'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

function LandingPageContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOAuthRedirect = searchParams.has('code');

  useEffect(() => {
    if (user) {
      router.push('/analyse');
    } else if (!loading && !isOAuthRedirect) {
      router.push('/login');
    }
  }, [user, loading, router, isOAuthRedirect]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-5xl font-bold mb-4">Property Document Analyzer</h1>
      <p className="text-lg mb-8">Loading...</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LandingPageContent />
    </Suspense>
  );
}
