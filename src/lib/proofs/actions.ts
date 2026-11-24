"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  approveLatestProof,
  createProofVersion,
  ProofError,
  requestProofChanges,
} from "./service";

export type ProofActionState = {
  error?: string;
  message?: string;
};

const orderIdSchema = z.uuid("That order link is not valid.");
const changeNoteSchema = z
  .string()
  .trim()
  .min(3, "Tell us what to change (at least a few words).")
  .max(1000, "Keep the note under 1,000 characters.");

async function run(
  formData: FormData,
  work: (orderId: string, userId: string, formData: FormData) => Promise<string>,
): Promise<ProofActionState> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const orderId = orderIdSchema.safeParse(formData.get("orderId"));

  if (!orderId.success) {
    return { error: orderId.error.issues[0]?.message ?? "That order link is not valid." };
  }

  try {
    const message = await work(orderId.data, user.id, formData);
    revalidatePath(`/account/orders/${orderId.data}/proof`);
    revalidatePath("/account");
    revalidatePath("/admin");
    return { message };
  } catch (error) {
    if (error instanceof ProofError) {
      return { error: error.message };
    }

    console.error("Proof action failed", error);
    return { error: "Something went wrong on our side. Please try again." };
  }
}

export async function generateProofAction(
  _previous: ProofActionState,
  formData: FormData,
): Promise<ProofActionState> {
  return run(formData, async (orderId, userId) => {
    const result = await createProofVersion(orderId, userId);
    return result.created ? `Proof v${result.version} is ready for review.` : `Proof v${result.version} is already waiting for your review.`;
  });
}

export async function approveProofAction(
  _previous: ProofActionState,
  formData: FormData,
): Promise<ProofActionState> {
  return run(formData, async (orderId, userId) => {
    const result = await approveLatestProof(orderId, userId);
    return `Proof v${result.version} approved. Production can now begin.`;
  });
}

export async function requestChangesAction(
  _previous: ProofActionState,
  formData: FormData,
): Promise<ProofActionState> {
  return run(formData, async (orderId, userId, data) => {
    const note = changeNoteSchema.safeParse(data.get("note"));

    if (!note.success) {
      throw new ProofError(note.error.issues[0]?.message ?? "Add a note describing the change.");
    }

    const result = await requestProofChanges(orderId, userId, note.data);
    return `Changes requested on v${result.version}. Edit your design, then submit the revision.`;
  });
}
