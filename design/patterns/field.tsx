// Read-only labeled value, used in the notice detail's classification panel.
export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-ink-2">{label}</div>
      <div className="mt-0.5 text-[13.5px]">{value ?? "—"}</div>
    </div>
  );
}
