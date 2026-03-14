import { objectStorageClient } from "./objectStorage";

const IMAGE_RETENTION_DAYS = 30;

function getBucketId(): string {
  const id = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!id) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return id;
}

function getImagePath(userId: number, receiptId: number): string {
  return `receipts/${userId}/${receiptId}.jpg`;
}

export async function uploadReceiptImage(
  userId: number,
  receiptId: number,
  imageBase64: string,
): Promise<{ imageUrl: string; imageExpiresAt: Date }> {
  const bucketId = getBucketId();
  const path = getImagePath(userId, receiptId);
  const bucket = objectStorageClient.bucket(bucketId);
  const file = bucket.file(path);

  const buffer = Buffer.from(imageBase64, "base64");
  await file.save(buffer, {
    contentType: "image/jpeg",
    resumable: false,
  });

  const imageExpiresAt = new Date();
  imageExpiresAt.setDate(imageExpiresAt.getDate() + IMAGE_RETENTION_DAYS);

  return { imageUrl: path, imageExpiresAt };
}

export async function getReceiptImageStream(
  imageUrl: string,
): Promise<{ stream: NodeJS.ReadableStream; contentType: string } | null> {
  try {
    const bucketId = getBucketId();
    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(imageUrl);

    const [exists] = await file.exists();
    if (!exists) return null;

    const stream = file.createReadStream();
    return { stream, contentType: "image/jpeg" };
  } catch {
    return null;
  }
}

export async function deleteReceiptImage(imageUrl: string): Promise<boolean> {
  const bucketId = getBucketId();
  const bucket = objectStorageClient.bucket(bucketId);
  const file = bucket.file(imageUrl);
  const [exists] = await file.exists();
  if (!exists) return true;
  await file.delete();
  return true;
}
