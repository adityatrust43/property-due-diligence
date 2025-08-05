import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
    region: process.env.NEXT_PUBLIC_AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    }
});

const REPORTS_BUCKET = process.env.NEXT_PUBLIC_S3_REPORTS_BUCKET!;

export async function POST(req: NextRequest) {
    try {
        const { analysisId } = await req.json();
        if (!analysisId) {
            return NextResponse.json({ error: 'Missing analysisId parameter' }, { status: 400 });
        }

        const reportKey = `reports/${analysisId}.json`;

        const getObjectParams = {
            Bucket: REPORTS_BUCKET,
            Key: reportKey,
        };

        const { Body } = await s3Client.send(new GetObjectCommand(getObjectParams));
        const reportContent = await streamToString(Body);

        return NextResponse.json({ status: 'COMPLETE', report: JSON.parse(reportContent) });

    } catch (error: any) {
        if (error.name === 'NoSuchKey') {
            return NextResponse.json({ status: 'PENDING' }, { status: 404 });
        }
        console.error('Error checking for report:', error);
        return NextResponse.json({ error: 'Failed to check for report', details: error.message }, { status: 500 });
    }
}

// Helper function to convert a stream to a string
function streamToString(stream: any): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on("data", (chunk: any) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    });
}
