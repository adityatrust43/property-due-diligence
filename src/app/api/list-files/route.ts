import { NextRequest, NextResponse } from 'next/server';
import { s3Client, UPLOADS_BUCKET_NAME } from '../../../lib/aws-s3';
import { ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function POST(req: NextRequest) {
    try {
        const { userId = 'admin' } = await req.json();
        
        const listObjectsParams = {
            Bucket: UPLOADS_BUCKET_NAME,
            Prefix: `uploads/${userId}/`,
        };

        const { Contents } = await s3Client.send(new ListObjectsV2Command(listObjectsParams));

        const documents: { [key: string]: { key: string; name: string; size: number; lastModified: Date; url: string; } } = {};

        if (Contents) {
            for (const file of Contents) {
                if (file.Key && file.Key.toLowerCase().endsWith('.pdf')) {
                    const pathParts = file.Key.split('/');
                    const fileName = pathParts.pop();
                    const folderName = pathParts.pop();
                    
                    const documentKey = `uploads/admin/${folderName}`;

                    if (!documents[documentKey] && fileName) {
                        const command = new GetObjectCommand({
                            Bucket: UPLOADS_BUCKET_NAME,
                            Key: file.Key,
                        });
                        // Generate a pre-signed URL that expires in 15 minutes
                        const url = await getSignedUrl(s3Client, command, { expiresIn: 900 });

                        documents[documentKey] = {
                            key: documentKey,
                            name: fileName,
                            size: file.Size ?? 0,
                            lastModified: file.LastModified!,
                            url: url,
                        };
                    }
                }
            }
        }

        const files = Object.values(documents).sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

        return NextResponse.json({ files });

    } catch (error: any) {
        console.error('Error listing files:', error);
        return NextResponse.json({ error: 'Failed to list files', details: error.message }, { status: 500 });
    }
}
