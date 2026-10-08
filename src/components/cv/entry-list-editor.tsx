"use client";

export interface EntryFieldConfig<T> {
  key: keyof T;
  label: string;
  kind: "text" | "textarea" | "lines"; // "lines": textarea <-> string[] (one item per line)
}

/**
 * One editor, reused for every array-of-objects CV section (employment
 * history, education, certifications, publications, projects, awards,
 * training, volunteer experience) via a per-section field config, rather
 * than a bespoke component per section.
 */
export function EntryListEditor<T extends object>({
  label,
  entries,
  onChange,
  fields,
  emptyEntry,
}: {
  label: string;
  entries: T[];
  onChange: (entries: T[]) => void;
  fields: EntryFieldConfig<T>[];
  emptyEntry: T;
}) {
  function updateEntry(index: number, key: keyof T, value: unknown) {
    const next = entries.slice();
    next[index] = { ...next[index], [key]: value } as T;
    onChange(next);
  }

  function removeEntry(index: number) {
    onChange(entries.filter((_, i) => i !== index));
  }

  return (
    <fieldset className="space-y-4">
      <legend className="font-serif text-lg text-ink">{label}</legend>

      {entries.length === 0 && (
        <p className="text-sm text-ink/50">Nothing extracted here — add an entry if this CV has one.</p>
      )}

      {entries.map((entry, i) => (
        <div key={i} className="space-y-3 rounded-sm border border-line p-4">
          {fields.map((f) => (
            <label key={String(f.key)} className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-ink/50">
                {f.label}
              </span>
              {f.kind === "text" && (
                <input
                  value={(entry[f.key] as string) ?? ""}
                  onChange={(e) => updateEntry(i, f.key, e.target.value)}
                  className="mt-1 w-full rounded-sm border border-line px-2.5 py-1.5 text-sm focus:border-navy focus:outline-none"
                />
              )}
              {f.kind === "textarea" && (
                <textarea
                  value={(entry[f.key] as string) ?? ""}
                  onChange={(e) => updateEntry(i, f.key, e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-sm border border-line px-2.5 py-1.5 text-sm focus:border-navy focus:outline-none"
                />
              )}
              {f.kind === "lines" && (
                <textarea
                  value={((entry[f.key] as string[] | undefined) ?? []).join("\n")}
                  onChange={(e) =>
                    updateEntry(
                      i,
                      f.key,
                      e.target.value.split("\n").map((s) => s.trim()).filter(Boolean)
                    )
                  }
                  rows={3}
                  placeholder="One per line"
                  className="mt-1 w-full rounded-sm border border-line px-2.5 py-1.5 text-sm focus:border-navy focus:outline-none"
                />
              )}
            </label>
          ))}
          <button
            type="button"
            onClick={() => removeEntry(i)}
            className="text-xs font-medium text-amber-dark hover:underline"
          >
            Remove this entry
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...entries, emptyEntry])}
        className="text-sm font-medium text-navy underline underline-offset-4"
      >
        + Add {label.toLowerCase().replace(/s$/, "")} entry
      </button>
    </fieldset>
  );
}
