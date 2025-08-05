'use client';

import { Amplify } from 'aws-amplify';

const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNito_USER_POOL_ID || '',
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID || '',
      identityPoolId: process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID || '',
      allowGuestAccess: true,
    },
  },
  Storage: {
    S3: {
      bucket: process.env.NEXT_PUBLIC_S3_UPLOADS_BUCKET || '',
      region: process.env.NEXT_PUBLIC_AWS_REGION || '',
    },
  },
};

Amplify.configure(amplifyConfig, { ssr: true });

export default function ConfigureAmplifyClientSide() {
  return null;
}
