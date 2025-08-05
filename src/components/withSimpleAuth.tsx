'use client';

import { useSimpleAuth } from '../hooks/useSimpleAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import LoadingSpinner from './property/LoadingSpinner';

const withSimpleAuth = <P extends object>(
  WrappedComponent: React.ComponentType<P>
): React.FC<P> => {
  const WithAuthComponent: React.FC<P> = (props) => {
    const { isLoggedIn, loading } = useSimpleAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading && !isLoggedIn) {
        router.replace('/login');
      }
    }, [isLoggedIn, loading, router]);

    if (loading || !isLoggedIn) {
      return (
        <div className="flex items-center justify-center h-screen">
          <LoadingSpinner />
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };

  return WithAuthComponent;
};

export default withSimpleAuth;
