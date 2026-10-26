import { NextResponse } from "next/server";
import { deletePerson, mapServerError } from "@/lib/server/faces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

export async function DELETE(_request: Request, props: { params: Promise<{ faceId: string }> }) {
  try {
    const params = await props.params;
    const { faceId } = params;

    if (!faceId || !faceId.trim()) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_id",
            message: "Identificador de rostro requerido.",
          },
        },
        { status: 400, headers: NO_CACHE_HEADERS },
      );
    }

    const result = await deletePerson(faceId);

    return NextResponse.json(result, {
      status: 200,
      headers: NO_CACHE_HEADERS,
    });
  } catch (error) {
    const { status, body } = mapServerError(error);
    return NextResponse.json(body, { status, headers: NO_CACHE_HEADERS });
  }
}
