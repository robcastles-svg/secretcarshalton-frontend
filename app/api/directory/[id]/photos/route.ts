import { NextRequest, NextResponse } from "next/server";
import { deleteListingPhoto, uploadListingPhotos } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

/** Owner-or-admin — SC_Directory_REST::check_owns_listing is the real authorization boundary, this just forwards the request. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { id } = await params;
  const listingId = Number(id);
  if (!listingId) {
    return NextResponse.json({ error: "Invalid listing." }, { status: 400 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "No photos received." }, { status: 400 });
  }

  const result = await uploadListingPhotos(token, listingId, formData);
  if ("gallery" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { id } = await params;
  const listingId = Number(id);
  const { attachmentId } = await request.json().catch(() => ({ attachmentId: undefined }));
  if (!listingId || !attachmentId) {
    return NextResponse.json({ error: "Missing photo." }, { status: 400 });
  }

  const result = await deleteListingPhoto(token, listingId, Number(attachmentId));
  if ("gallery" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
