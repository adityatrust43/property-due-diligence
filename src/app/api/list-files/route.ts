import { NextRequest, NextResponse } from 'next/server';
import { s3Client, UPLOADS_BUCKET_NAME } from '../../../lib/aws-s3';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';

export async function POST(req: NextRequest) {
    try {
        const { userId = 'admin' } = await req.json();
        
        const listObjectsParams = {
            Bucket: UPLOADS_BUCKET_NAME,
            Prefix: `uploads/${userId}/`,
        };

        const { Contents } = await s3Client.send(new ListObjectsV2Command(listObjectsParams));

        const documents: { [key: string]: { key: string; name: string; size: number; lastModified: Date; } } = {};

        if (Contents) {
            for (const file of Contents) {
                const pathParts = file.Key!.split('/');
                if (pathParts.length >= 3) {
                    // The folder key is 'uploads/admin/filename.pdf'
                    const folderKey = pathParts.slice(0, 3).join('/');
                    const fileNameWithExt = pathParts[2];

                    // The main object is the PDF itself, not the images inside the 'images' subfolder
                    if (file.Key === `${folderKey}/${fileNameWithExt}`) {
                         if (!documents[folderKey]) {
                            documents[folderKey] = {
                                key: folderKey,
                                name: fileNameWithExt,
                                size: file.Size ?? 0,
                                lastModified: file.LastModified!,
                            };
                        }
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
