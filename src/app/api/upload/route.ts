import { NextRequest, NextResponse } from 'next/server';
import { s3Client, UPLOADS_BUCKET_NAME } from '../../../lib/aws-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const images = formData.getAll('images') as File[];

  if (!file || !images || images.length === 0) {
    return NextResponse.json({ error: 'Missing file or images' }, { status: 400 });
  }

  const filename = file.name;
  const fileKey = `uploads/admin/${filename}/${filename}`;

  try {
    // Convert file and images to buffers
    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    const imageBuffers = await Promise.all(images.map(async (image) => Buffer.from(await image.arrayBuffer())));

    // Upload the original PDF
    const pdfUploadCommand = new PutObjectCommand({
      Bucket: UPLOADS_BUCKET_NAME,
      Key: fileKey,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    });
    await s3Client.send(pdfUploadCommand);

    // Upload each image to S3
    const imageUploadPromises = imageBuffers.map((buffer, index) => {
      const imageKey = `uploads/admin/${filename}/images/page_${index + 1}.png`;
      const imageUploadCommand = new PutObjectCommand({
        Bucket: UPLOADS_BUCKET_NAME,
        Key: imageKey,
        Body: buffer,
        ContentType: 'image/png',
      });
      return s3Client.send(imageUploadCommand);
    });

    await Promise.all(imageUploadPromises);

    return NextResponse.json({ message: 'File and images uploaded successfully', key: `uploads/admin/${filename}` });
  } catch (error) {
    console.error('Error processing file upload:', error);
    return NextResponse.json({ error: 'Error processing file upload' }, { status: 500 });
  }
}
