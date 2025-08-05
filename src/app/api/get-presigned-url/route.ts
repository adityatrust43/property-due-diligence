import { NextRequest, NextResponse } from 'next/server';
import { getS3Client, UPLOADS_BUCKET_NAME } from '../../../lib/aws-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function POST(req: NextRequest) {
    try {
        const { fileName, fileType, imageCount } = await req.json();
        if (!fileName || !fileType || imageCount === undefined) {
            return NextResponse.json({ error: 'Missing fileName, fileType, or imageCount' }, { status: 400 });
        }

        const s3Client = getS3Client();
        const fileKey = `uploads/admin/${fileName}/${fileName}`;

        const pdfCommand = new PutObjectCommand({
            Bucket: UPLOADS_BUCKET_NAME,
            Key: fileKey,
            ContentType: fileType,
        });

        const pdfSignedUrl = await getSignedUrl(s3Client, pdfCommand, { expiresIn: 3600 });

        const imageSignedUrls = [];
        for (let i = 0; i < imageCount; i++) {
            const imageKey = `${fileKey}/images/page_${i + 1}.png`;
            const imageCommand = new PutObjectCommand({
                Bucket: UPLOADS_BUCKET_NAME,
                Key: imageKey,
                ContentType: 'image/png',
            });
            const signedUrl = await getSignedUrl(s3Client, imageCommand, { expiresIn: 3600 });
            imageSignedUrls.push(signedUrl);
        }

        return NextResponse.json({ pdfSignedUrl, imageSignedUrls, key: fileKey });

    } catch (error: any) {
        console.error('Error creating presigned URLs:', error);
        return NextResponse.json({ error: 'Failed to create presigned URLs', details: error.message }, { status: 500 });
    }
}
