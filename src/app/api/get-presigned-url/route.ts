import { NextRequest, NextResponse } from 'next/server';
import { getS3Client, UPLOADS_BUCKET_NAME } from '../../../lib/aws-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function POST(req: NextRequest) {
    try {
        const { fileName, fileType } = await req.json();
        if (!fileName || !fileType) {
            return NextResponse.json({ error: 'Missing fileName or fileType' }, { status: 400 });
        }

        const s3Client = getS3Client();
        const fileKey = `uploads/admin/${fileName}/${fileName}`;

        const command = new PutObjectCommand({
            Bucket: UPLOADS_BUCKET_NAME,
            Key: fileKey,
            ContentType: fileType,
        });

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        return NextResponse.json({ signedUrl, key: fileKey });

    } catch (error: any) {
        console.error('Error creating presigned URL:', error);
        return NextResponse.json({ error: 'Failed to create presigned URL', details: error.message }, { status: 500 });
    }
}
