import { NextRequest, NextResponse } from 'next/server';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { randomUUID } from 'crypto';

const sfnClient = new SFNClient({
    region: process.env.NEXT_PUBLIC_AWS_REGION,
    credentials: {
        accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY!,
    }
});

const STATE_MACHINE_ARN = 'arn:aws:states:us-east-1:530349877694:stateMachine:pdf-processing-workflow';

export async function POST(req: NextRequest) {
    try {
        const { key } = await req.json();
        if (!key) {
            return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
        }

        // The key from the frontend is the folder path, e.g., "uploads/admin/My File"
        const s3Key = key;
        const fileName = `${key.split('/').pop()}.pdf`;
        const analysisId = randomUUID();

        const payload = { s3Key, fileName, analysisId };
        console.log("Starting Step Functions execution with payload:", JSON.stringify(payload, null, 2));

        const startExecutionParams = {
            stateMachineArn: STATE_MACHINE_ARN,
            input: JSON.stringify(payload),
            name: `analysis-${analysisId}` // Execution name must be unique
        };

        const command = new StartExecutionCommand(startExecutionParams);
        const result = await sfnClient.send(command);

        console.log("Step Functions execution started:", result);

        return NextResponse.json({ success: true, message: 'Analysis started', analysisId });

    } catch (error: any) {
        console.error('Error starting Step Functions execution:', error);
        return NextResponse.json({ error: 'Failed to start analysis', details: error.message }, { status: 500 });
    }
}
