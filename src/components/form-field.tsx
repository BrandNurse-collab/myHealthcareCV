export function FormField({
  label,
  name,
  type = "text",
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink/80">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
      />
    </label>
  );
}
