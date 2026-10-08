"use client";

export function StringListField({
  label,
  values,
  onChange,
  hint,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink/80">{label}</span>
      {hint && <span className="block text-xs text-ink/50">{hint}</span>}
      <textarea
        value={values.join("\n")}
        onChange={(e) =>
          onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))
        }
        rows={4}
        placeholder="One per line"
        className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-sm focus:border-navy focus:outline-none"
      />
    </label>
  );
}
