"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { validateCvFile } from "@/lib/cv/validate";
import { processCvExtraction } from "@/lib/cv/process-extraction";
import type { CvStructuredData } from "@/types/cv";

export async function uploadCv(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/dashboard/cvs/new?error=" + encodeURIComponent("Choose a file to upload."));
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const bytes = Buffer.from(await file.arrayBuffer());
  const validation = validateCvFile(file.name, file.type, file.size, bytes);
  if (!validation.ok) {
    redirect("/dashboard/cvs/new?error=" + encodeURIComponent(validation.error));
  }
  // `validation.ok` is narrowed to `true` at this point — the branch above
  // always redirects (and therefore never returns) otherwise.
  const { fileType } = validation as { ok: true; fileType: "pdf" | "docx" };

  const uploadedCvId = randomUUID();
  const storagePath = `${user.id}/${uploadedCvId}/${file.name}`;

  const { error: storageError } = await supabase.storage
    .from("cvs")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (storageError) {
    redirect("/dashboard/cvs/new?error=" + encodeURIComponent("Upload failed: " + storageError.message));
  }

  const { error: insertError } = await supabase.from("uploaded_cvs").insert({
    id: uploadedCvId,
    user_id: user.id,
    storage_path: storagePath,
    original_filename: file.name,
    file_type: fileType,
    file_size_bytes: file.size,
    status: "uploaded",
  });
  if (insertError) {
    await supabase.storage.from("cvs").remove([storagePath]); // best-effort cleanup
    redirect("/dashboard/cvs/new?error=" + encodeURIComponent("Couldn't save the upload: " + insertError.message));
  }

  const serviceClient = createServiceRoleClient();
  await serviceClient
    .from("usage_logs")
    .insert({ user_id: user.id, event_type: "cv_uploaded", metadata: { uploaded_cv_id: uploadedCvId } });

  // Synchronous for Phase 2 — no background job queue yet. Revisit if CV
  // sizes or AI latency start pushing this toward the platform's function
  // time limit (see ARCHITECTURE.md § AI architecture for the fast/strong
  // model split this already leans on to keep this step quick).
  await processCvExtraction(supabase, uploadedCvId, fileType, bytes);

  redirect(`/dashboard/cvs/${uploadedCvId}`);
}

export async function retryExtraction(uploadedCvId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cv, error } = await supabase
    .from("uploaded_cvs")
    .select("storage_path, file_type")
    .eq("id", uploadedCvId)
    .single();
  if (error || !cv) redirect("/dashboard");

  const { storage_path: storagePath, file_type: fileType } = cv as {
    storage_path: string;
    file_type: "pdf" | "docx";
  };

  const { data: downloaded, error: downloadError } = await supabase.storage
    .from("cvs")
    .download(storagePath);
  if (downloadError || !downloaded) {
    redirect(`/dashboard/cvs/${uploadedCvId}?error=` + encodeURIComponent("Couldn't re-read the stored file."));
  }

  const bytes = Buffer.from(await (downloaded as Blob).arrayBuffer());
  await processCvExtraction(supabase, uploadedCvId, fileType, bytes);

  revalidatePath(`/dashboard/cvs/${uploadedCvId}`);
  redirect(`/dashboard/cvs/${uploadedCvId}`);
}

export async function updateExtractedData(uploadedCvId: string, data: CvStructuredData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("cv_extracted_data")
    .update({ structured_data: data, reviewed_by_user: true })
    .eq("uploaded_cv_id", uploadedCvId);
  if (error) {
    redirect(`/dashboard/cvs/${uploadedCvId}?error=` + encodeURIComponent("Couldn't save: " + error.message));
  }

  redirect("/dashboard");
}
