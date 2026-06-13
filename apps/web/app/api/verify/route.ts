import { NextResponse } from "next/server";
import { verifyBytes, verifyFixture } from "@/lib/registry.server";

export const runtime = "nodejs";

/**
 * Runs the real verify() engine. Two modes:
 *  - multipart/form-data: { name, bundle (file), manifest (file) } — honest upload path.
 *  - application/json:     { name, fixture: true } — verify a seeded fixture's on-disk bytes.
 */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { name?: string; fixture?: boolean };
      if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
      const response = await verifyFixture(body.name);
      return NextResponse.json(response);
    }

    const form = await req.formData();
    const name = form.get("name");
    const bundle = form.get("bundle");
    const manifest = form.get("manifest");

    if (typeof name !== "string") {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    if (!(bundle instanceof File) || !(manifest instanceof File)) {
      return NextResponse.json(
        { error: "both bundle and manifest files are required" },
        { status: 400 },
      );
    }

    const response = await verifyBytes(
      name,
      new Uint8Array(await bundle.arrayBuffer()),
      new Uint8Array(await manifest.arrayBuffer()),
    );
    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
