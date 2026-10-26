import { NextResponse } from "next/server";
import { enrollPerson, listPeople, mapServerError } from "@/lib/server/faces";
import { registerPersonSchema } from "@/lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor") || undefined;

    const result = await listPeople(cursor);

    return NextResponse.json(result, {
      status: 200,
      headers: NO_CACHE_HEADERS,
    });
  } catch (error) {
    const { status, body } = mapServerError(error);
    return NextResponse.json(body, { status, headers: NO_CACHE_HEADERS });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image");
    const rawName = formData.get("name");
    const rawConsent = formData.get("consent");

    // Validate inputs
    const validatedFields = registerPersonSchema.safeParse({
      name: rawName,
      consent: rawConsent,
    });

    if (!validatedFields.success) {
      const firstIssue = validatedFields.error.issues[0];
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: firstIssue?.message || "Datos de registro inválidos.",
          },
        },
        { status: 400, headers: NO_CACHE_HEADERS },
      );
    }

    if (!imageFile || !(imageFile instanceof Blob)) {
      return NextResponse.json(
        {
          error: {
            code: "missing_image",
            message: "Debe seleccionar un archivo de imagen (JPEG o PNG).",
          },
        },
        { status: 400, headers: NO_CACHE_HEADERS },
      );
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const person = await enrollPerson(
      buffer,
      validatedFields.data.name,
      validatedFields.data.consent,
    );

    return NextResponse.json(person, {
      status: 201,
      headers: NO_CACHE_HEADERS,
    });
  } catch (error) {
    const { status, body } = mapServerError(error);
    return NextResponse.json(body, { status, headers: NO_CACHE_HEADERS });
  }
}
