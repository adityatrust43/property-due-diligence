import { NextRequest, NextResponse } from 'next/server';
import { LambdaClient, InvokeCommand, InvocationType } from '@aws-sdk/client-lambda';
import { randomUUID } from 'crypto';

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
        const { key } = await req.json();
        if (!key) {
            return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
        }

        const fileName = key.split('/').pop();
        const analysisId = randomUUID();

        const payload = { s3Key: key, fileName, analysisId };
        console.log("Invoking Lambda with payload:", JSON.stringify(payload, null, 2));

        const invokeParams = {
            FunctionName: FUNCTION_NAME,
            InvocationType: InvocationType.Event, // Asynchronous invocation
            Payload: JSON.stringify(payload),
        };

        const command = new InvokeCommand(invokeParams);
        const result = await lambdaClient.send(command);

        console.log("Lambda invocation result:", result);

        return NextResponse.json({ success: true, message: 'Analysis started', analysisId });

    } catch (error: any) {
        console.error('Error invoking Lambda function:', error);
        return NextResponse.json({ error: 'Failed to start analysis', details: error.message }, { status: 500 });
    }
}
