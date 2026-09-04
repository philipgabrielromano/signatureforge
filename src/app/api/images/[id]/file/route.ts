import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, unauthorizedResponse } from "@/lib/auth";
import { getPrimaryTenant } from "@/lib/tenant";
import { downloadImageFromBlob } from "@/lib/azureBlob";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const tenant = await getPrimaryTenant();
  const image = await prisma.signatureImage.findUnique({ where: { id: params.id } });
  if (!image || image.tenantId !== tenant.id) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const { buffer, contentType } = await downloadImageFromBlob(image.filename);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${encodeURIComponent(image.originalName)}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read blob" },
      { status: 502 }
    );
  }
}
