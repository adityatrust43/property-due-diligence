import { S3Client } from '@aws-sdk/client-s3';

const REGION = process.env.NEXT_PUBLIC_AWS_REGION;
const UPLOADS_BUCKET_NAME = process.env.NEXT_PUBLIC_S3_UPLOADS_BUCKET;
const REPORTS_BUCKET_NAME = process.env.NEXT_PUBLIC_S3_REPORTS_BUCKET;
const ACCESS_KEY_ID = process.env.MY_AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.MY_AWS_SECRET_ACCESS_KEY;

let s3Client: S3Client | null = null;

function getS3Client() {
  if (!REGION || !UPLOADS_BUCKET_NAME || !REPORTS_BUCKET_NAME || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error("AWS configuration environment variables are not set.");
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

export { getS3Client, UPLOADS_BUCKET_NAME, REPORTS_BUCKET_NAME };
