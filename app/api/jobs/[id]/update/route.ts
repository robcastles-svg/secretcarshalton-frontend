import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth";
import { ownSave } from "@/lib/owner-edit";

/** Saves the member's changes to their own job (SC_Jobs_REST::update_job checks ownership). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const { id } = await params;
  const formData = await request.formData().catch(() => null);
  if (!formData || !/^\d+$/.test(id)) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  const res = await ownSave(token, `sc-jobs/v1/${id}/update`, formData);
  if (res.ok) {
    revalidatePath("/jobs");
    revalidatePath("/jobs/[slug]", "page");
  }
  return res;
}
