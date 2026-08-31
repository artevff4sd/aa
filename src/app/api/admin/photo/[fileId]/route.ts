import { NextRequest } from "next/server";
import { getFile, getFileUrl } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  try {
    const result = await getFile(decodeURIComponent(fileId));
    if (!result.ok || !result.result?.file_path) {
      return new Response("File not found", { status: 404 });
    }
    const fileUrl = getFileUrl(result.result.file_path);
    const response = await fetch(fileUrl);
    if (!response.ok) {
      return new Response("Failed to fetch file", { status: 500 });
    }
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Photo proxy error:", error);
    return new Response("Internal error", { status: 500 });
  }
}
