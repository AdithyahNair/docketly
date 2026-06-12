import { TEXT } from "@/design/tokens";

// Read-only labeled value, used in the notice detail's classification panel.
export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className={TEXT.fieldLabel}>{label}</div>
      <div className="text-sm">{value ?? "—"}</div>
    </div>
  );
}
