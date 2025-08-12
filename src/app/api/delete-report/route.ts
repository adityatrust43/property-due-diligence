import { NextRequest, NextResponse } from 'next/server';
import { s3Client, REPORTS_BUCKET_NAME } from '../../../lib/aws-s3';
import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

export async function POST(req: NextRequest) {
    try {
        const { key } = await req.json();
        if (!key) {
            return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
        }

        const listParams = {
            Bucket: REPORTS_BUCKET_NAME,
            Prefix: key,
        };

        const listedObjects = await s3Client.send(new ListObjectsV2Command(listParams));

        if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
            return NextResponse.json({ success: true, message: 'No objects to delete.' });
        }

        const deleteParams = {
            Bucket: REPORTS_BUCKET_NAME,
            Delete: {
                Objects: listedObjects.Contents.map(({ Key }) => ({ Key })),
            },
        };

        await s3Client.send(new DeleteObjectsCommand(deleteParams));

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error deleting report:', error);
        return NextResponse.json({ error: 'Failed to delete report', details: error.message }, { status: 500 });
    }
}
