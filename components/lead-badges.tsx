import { programLabel } from "@/lib/leads/classification";
import { getInitials } from "@/lib/text";

export function ProgramChips({ programs, limit }: { programs: string[]; limit?: number }) {
  if (programs.length === 0) return null;
  const shown = limit ? programs.slice(0, limit) : programs;
  const hidden = programs.length - shown.length;
  return (
    <span title={programs.map(programLabel).join(", ")} className="flex flex-wrap gap-1">
      {shown.map((program) => (
        <span key={program} className="whitespace-nowrap rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-800">{programLabel(program)}</span>
      ))}
      {hidden > 0 && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">+{hidden}</span>}
    </span>
  );
}

export function OwnerAvatar({ name }: { name: string | null }) {
  if (!name) return <span className="text-[11px] text-slate-500">Unassigned</span>;
  return (
    <span title={`Owner: ${name}`} className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-950 text-[10px] font-semibold text-white">
      {getInitials(name)}
    </span>
  );
}
