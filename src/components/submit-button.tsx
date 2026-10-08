"use client";

import { useFormStatus } from "react-dom";

const VARIANTS = {
  amber: "bg-amber text-paper hover:bg-amber-dark",
  navy: "bg-navy text-paper hover:bg-navy-dark",
} as const;

export function SubmitButton({
  children,
  pendingLabel,
  variant = "amber",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: keyof typeof VARIANTS;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`rounded-sm px-6 py-3 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-60 ${VARIANTS[variant]}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
