import { NextRequest, NextResponse } from 'next/server';
import { LambdaClient, InvokeCommand, InvocationType } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({
    region: process.env.NEXT_PUBLIC_AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    }
});

const FUNCTION_NAME = 'document-analysis-function-v2';

export async function POST(req: NextRequest) {
    try {
        const { imageParts, fileName, s3Key } = await req.json();
        if (!imageParts || !fileName || !s3Key) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const invokeParams = {
            FunctionName: FUNCTION_NAME,
            InvocationType: InvocationType.RequestResponse, // Synchronous invocation
            Payload: JSON.stringify({ body: JSON.stringify({ imageParts, fileName, s3Key }) }),
        };

        const command = new InvokeCommand(invokeParams);
        const { Payload } = await lambdaClient.send(command);
        const result = JSON.parse(Buffer.from(Payload!).toString());

        return NextResponse.json(JSON.parse(result.body));

    } catch (error: any) {
        console.error('Error invoking Lambda function:', error);
        return NextResponse.json({ error: 'Failed to start analysis', details: error.message }, { status: 500 });
    }
}
