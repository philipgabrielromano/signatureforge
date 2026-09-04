import {
  BlobSASPermissions,
  BlobServiceClient,
  ContainerClient,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";
import { randomUUID } from "crypto";

const READ_SAS_MINUTES = 10 * 365 * 24 * 60;

export function isAzureStorageConfigured(): boolean {
  return Boolean(
    process.env.AZURE_STORAGE_ACCOUNT_NAME &&
      process.env.AZURE_STORAGE_ACCOUNT_KEY &&
      process.env.AZURE_STORAGE_CONTAINER_NAME &&
      !process.env.AZURE_STORAGE_ACCOUNT_KEY.includes("your-storage")
  );
}

function getAccountName(): string {
  return process.env.AZURE_STORAGE_ACCOUNT_NAME || "";
}

function getAccountKey(): string {
  return process.env.AZURE_STORAGE_ACCOUNT_KEY || "";
}

function getContainerName(): string {
  return process.env.AZURE_STORAGE_CONTAINER_NAME || "";
}

function getContainerClient(): ContainerClient {
  const accountName = getAccountName();
  const accountKey = getAccountKey();
  const container = getContainerName();

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

function encodeBlobPath(blobName: string): string {
  return blobName.split("/").map(encodeURIComponent).join("/");
}

function stripQuery(url: string): string {
  return url.split("?")[0].replace(/\/$/, "");
}

export function isSignedBlobUrl(url: string): boolean {
  try {
    return new URL(url).searchParams.has("sig");
  } catch {
    return false;
  }
}

export function blobPreviewPath(imageId: string): string {
  return `/api/images/${imageId}/file`;
}

/** Canonical HTTPS URL for a blob, without a SAS query string. */
export function unsignedBlobUrl(blobName: string): string {
  const encoded = encodeBlobPath(blobName);
  const configured = process.env.AZURE_STORAGE_PUBLIC_URL?.trim();
  if (configured) {
    const base = stripQuery(configured);
    const accountRoot = `https://${getAccountName()}.blob.core.windows.net`;
    const container = getContainerName();
    if (base === accountRoot && container) {
      return `${accountRoot}/${container}/${encoded}`;
    }
    return `${base}/${encoded}`;
  }
  return `https://${getAccountName()}.blob.core.windows.net/${getContainerName()}/${encoded}`;
}

export async function getBlobSasUrl(blobName: string, expiryMinutes = READ_SAS_MINUTES): Promise<string> {
  const accountName = getAccountName();
  const accountKey = getAccountKey();
  const container = getContainerName();
  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  const startsOn = new Date(Date.now() - 5 * 60 * 1000);
  const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: container,
      blobName,
      permissions: BlobSASPermissions.parse("r"),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    },
    sharedKeyCredential
  ).toString();

  const client = getContainerClient().getBlockBlobClient(blobName);
  return `${stripQuery(client.url)}?${sasToken}`;
}

/**
 * URL Outlook (and <img> tags) can fetch. Containers are often private, so
 * unsigned blob URLs 403 even after a successful authenticated upload.
 * A long-lived account-key SAS keeps signatures working without opening the container.
 */
export async function getDurablePublicUrl(blobName: string): Promise<string> {
  try {
    return await getBlobSasUrl(blobName);
  } catch (error) {
    console.warn("[azure-blob] SAS mint failed; storing unsigned URL", error);
    return unsignedBlobUrl(blobName);
  }
}

export function blobNameFromPublicUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
    const container = getContainerName();
    if (parsed.hostname.endsWith(".blob.core.windows.net")) {
      if (container && parts[0] === container) {
        return parts.slice(1).join("/") || null;
      }
      if (parts[0] === "signatures") {
        return parts.join("/");
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function withSignedImageUrls(html: string): Promise<string> {
  if (!isAzureStorageConfigured()) return html;
  const matches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
  let result = html;
  const seen = new Set<string>();
  for (const match of matches) {
    const src = match[1];
    if (!src || seen.has(src) || isSignedBlobUrl(src)) continue;
    seen.add(src);
    const blobName = blobNameFromPublicUrl(src);
    if (!blobName) continue;
    try {
      const signed = await getDurablePublicUrl(blobName);
      result = result.replaceAll(src, signed);
    } catch (error) {
      console.warn("[azure-blob] Could not sign image URL", src, error);
    }
  }
  return result;
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
      blobContentDisposition: "inline",
    },
  });

  const publicUrl = await getDurablePublicUrl(blobName);
  return { blobName, publicUrl, size: file.length };
}

export async function deleteImageFromBlob(blobName: string): Promise<void> {
  const containerClient = getContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.deleteIfExists();
}

export async function downloadImageFromBlob(
  blobName: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const containerClient = getContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const download = await blockBlobClient.download();
  if (!download.readableStreamBody) {
    throw new Error("Empty blob response");
  }
  const chunks: Buffer[] = [];
  for await (const chunk of download.readableStreamBody) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return {
    buffer: Buffer.concat(chunks),
    contentType: download.contentType ?? "application/octet-stream",
  };
}

export async function testBlobConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const client = getContainerClient();
    const exists = await client.exists();
    if (!exists) {
      return { ok: false, message: "Container does not exist. Create it in the Azure Portal." };
    }
    return { ok: true, message: `Connected to container "${client.containerName}".` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
