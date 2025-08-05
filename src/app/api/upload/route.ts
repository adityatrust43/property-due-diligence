import { NextRequest, NextResponse } from 'next/server';
import { getS3Client, UPLOADS_BUCKET_NAME } from '../../../lib/aws-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const key = formData.get('key') as string;
  const images = formData.getAll('images') as File[];

  if (!key || !images || images.length === 0) {
    return NextResponse.json({ error: 'Missing key or images' }, { status: 400 });
  }

  try {
    const s3Client = getS3Client();
    const imageBuffers = await Promise.all(images.map(async (image) => Buffer.from(await image.arrayBuffer())));

    // Upload each image to S3
    const imageUploadPromises = imageBuffers.map((buffer, index) => {
      const imageKey = `${key}/images/page_${index + 1}.png`;
      const imageUploadCommand = new PutObjectCommand({
        Bucket: UPLOADS_BUCKET_NAME,
        Key: imageKey,
        Body: buffer,
        ContentType: 'image/png',
      });
      return s3Client.send(imageUploadCommand);
    });

    await Promise.all(imageUploadPromises);

    return NextResponse.json({ message: 'Images uploaded successfully', key });
  } catch (error) {
    console.error('Error processing image upload:', error);
    return NextResponse.json({ error: 'Error processing image upload' }, { status: 500 });
  }
}
