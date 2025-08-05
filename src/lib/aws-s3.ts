import { S3Client } from '@aws-sdk/client-s3';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';

const REGION = process.env.NEXT_PUBLIC_AWS_REGION!;
const UPLOADS_BUCKET_NAME = process.env.NEXT_PUBLIC_S3_UPLOADS_BUCKET!;
const REPORTS_BUCKET_NAME = process.env.NEXT_PUBLIC_S3_REPORTS_BUCKET!;
const IDENTITY_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID!;

if (!REGION || !UPLOADS_BUCKET_NAME || !REPORTS_BUCKET_NAME || !IDENTITY_POOL_ID) {
  throw new Error("AWS configuration environment variables are not set.");
}

const credentials = fromCognitoIdentityPool({
  clientConfig: { region: REGION },
  identityPoolId: IDENTITY_POOL_ID,
});

const s3Client = new S3Client({
  region: REGION,
  credentials,
});

export { s3Client, UPLOADS_BUCKET_NAME, REPORTS_BUCKET_NAME };
