import { NextResponse } from "next/server";
import { recognizeFaces, mapServerError } from "@/lib/server/faces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image");

    if (!imageFile || !(imageFile instanceof Blob)) {
      return NextResponse.json(
        {
          error: {
            code: "missing_image",
            message: "Debe seleccionar un archivo de fotografía para reconocer rostros.",
          },
        },
        { status: 400, headers: NO_CACHE_HEADERS },
      );
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await recognizeFaces(buffer);

    return NextResponse.json(result, {
      status: 200,
      headers: NO_CACHE_HEADERS,
    });
  } catch (error) {
    const { status, body } = mapServerError(error);
    return NextResponse.json(body, { status, headers: NO_CACHE_HEADERS });
  }
}
