'use client';

import { useState, useEffect } from 'react';
import { Hub } from 'aws-amplify/utils';
import { getCurrentUser, AuthUser, fetchUserAttributes } from 'aws-amplify/auth';

interface CustomAuthUser extends AuthUser {
  attributes?: {
    [key: string]: string | undefined;
  };
}

export function useAuth() {
  const [user, setUser] = useState<CustomAuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      setLoading(true);
      try {
        const currentUser = await getCurrentUser();
        const attributes = await fetchUserAttributes();
        setUser({ ...currentUser, attributes });
      } catch (error) {
        setUser(null);
      }
      setLoading(false);
    };

    checkUser();

    const hubListener = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
        case 'tokenRefresh':
          checkUser();
          break;
        case 'signedOut':
          setUser(null);
          break;
      }
    });

    return () => {
      hubListener();
    };
  }, []);

  return { user, loading };
}
