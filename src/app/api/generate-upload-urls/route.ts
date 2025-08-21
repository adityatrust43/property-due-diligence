import { NextRequest, NextResponse } from 'next/server';
import { s3Client, UPLOADS_BUCKET_NAME } from '../../../lib/aws-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function POST(req: NextRequest) {
  try {
    const { files } = await req.json();

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid files array' }, { status: 400 });
    }

    const urls = await Promise.all(
      files.map(async (file: { name: string; type: string }) => {
        const Key = `uploads/admin/${file.name}`;
        const command = new PutObjectCommand({
          Bucket: UPLOADS_BUCKET_NAME,
          Key,
          ContentType: file.type,
        });
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        return { name: file.name, url, key: Key };
      })
    );

    return NextResponse.json({ urls });
  } catch (error) {
    console.error('Error generating pre-signed URLs:', error);
    return NextResponse.json({ error: 'Error generating pre-signed URLs' }, { status: 500 });
  }
}
