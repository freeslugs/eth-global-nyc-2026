import { NextResponse } from "next/server";
import { verifyBytes, verifyFixture } from "@/lib/registry.server";

export const runtime = "nodejs";

/**
 * Runs the real gate() engine. Two modes:
 *  - multipart/form-data: { name, skill (SKILL.md file) } — honest upload path.
 *  - application/json:     { name, fixture: true } — verify a seeded skill's bytes.
 */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { name?: string; fixture?: boolean };
      if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
      return NextResponse.json(await verifyFixture(body.name));
    }

    const form = await req.formData();
    const name = form.get("name");
    const skill = form.get("skill");

    if (typeof name !== "string") {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    if (!(skill instanceof File)) {
      return NextResponse.json({ error: "a SKILL.md file is required" }, { status: 400 });
    }

    const response = await verifyBytes(name, new Uint8Array(await skill.arrayBuffer()));
    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
