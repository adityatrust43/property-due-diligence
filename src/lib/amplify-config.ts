import { Amplify } from 'aws-amplify';

const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID || '',
      identityPoolId: process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID || '',
      loginWith: {
        oauth: {
          domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '',
          scopes: ['profile', 'email', 'openid'],
          redirectSignIn: ['http://localhost:9002/auth/callback/'],
          redirectSignOut: ['http://localhost:9002/login'],
          responseType: 'code' as const,
        },
      },
    },
  },
  Storage: {
    S3: {
      bucket: process.env.NEXT_PUBLIC_S3_UPLOADS_BUCKET || '',
      region: process.env.NEXT_PUBLIC_AWS_REGION || '',
    },
  },
};

export default amplifyConfig;
