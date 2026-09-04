import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { randomUUID } from "crypto";

export function isAzureStorageConfigured(): boolean {
  return Boolean(
    process.env.AZURE_STORAGE_ACCOUNT_NAME &&
      process.env.AZURE_STORAGE_ACCOUNT_KEY &&
      process.env.AZURE_STORAGE_CONTAINER_NAME &&
      !process.env.AZURE_STORAGE_ACCOUNT_KEY.includes("your-storage")
  );
}

function getContainerClient(): ContainerClient {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
  const container = process.env.AZURE_STORAGE_CONTAINER_NAME;

  if (!accountName || !accountKey || !container) {
    throw new Error(
      "Azure Blob Storage is not configured. Set AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY, and AZURE_STORAGE_CONTAINER_NAME."
    );
  }

  const connectionString =
    `DefaultEndpointsProtocol=https;` +
    `AccountName=${accountName};` +
    `AccountKey=${accountKey};` +
    `EndpointSuffix=core.windows.net`;

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  return blobServiceClient.getContainerClient(container);
}

export async function uploadImageToBlob(
  file: Buffer,
  originalName: string,
  mimeType: string,
  tenantId: string
): Promise<{ blobName: string; publicUrl: string; size: number }> {
  const ext = originalName.split(".").pop()?.toLowerCase() || "png";
  const blobName = `signatures/${tenantId}/${randomUUID()}.${ext}`;
  const containerClient = getContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(file, {
    blobHTTPHeaders: {
      blobContentType: mimeType,
      blobCacheControl: "public, max-age=31536000, immutable",
    },
  });

  const baseUrl =
    process.env.AZURE_STORAGE_PUBLIC_URL ||
    `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${process.env.AZURE_STORAGE_CONTAINER_NAME}`;

  const publicUrl = `${baseUrl.replace(/\/$/, "")}/${blobName}`;
  return { blobName, publicUrl, size: file.length };
}

export async function deleteImageFromBlob(blobName: string): Promise<void> {
  const containerClient = getContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.deleteIfExists();
}

export async function testBlobConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const client = getContainerClient();
    const exists = await client.exists();
    if (!exists) {
      return { ok: false, message: "Container does not exist. Create it with Blob public access." };
    }
    return { ok: true, message: `Connected to container "${client.containerName}".` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function getBlobSasUrl(blobName: string, expiryMinutes = 60): Promise<string> {
  const {
    StorageSharedKeyCredential,
    generateBlobSASQueryParameters,
    BlobSASPermissions,
  } = await import("@azure/storage-blob");

  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY!;
  const container = process.env.AZURE_STORAGE_CONTAINER_NAME!;
  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: container,
      blobName,
      permissions: BlobSASPermissions.parse("r"),
      expiresOn,
    },
    sharedKeyCredential
  ).toString();

  return `https://${accountName}.blob.core.windows.net/${container}/${blobName}?${sasToken}`;
}
