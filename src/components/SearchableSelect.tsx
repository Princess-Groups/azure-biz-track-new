import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export type SearchableOption = { value: string; label: string };

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "— select —",
  othersLabel = "+ Others (custom)",
  includeOthers = true,
  includeNone = true,
  noneLabel = "— none —",
}: {
  value: string;
  onChange: (v: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  othersLabel?: string;
  includeOthers?: boolean;
  includeNone?: boolean;
  noneLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else setQ("");
  }, [open]);

  const selectedLabel = useMemo(() => {
    if (value === "__other") return othersLabel;
    if (!value) return placeholder;
    return options.find((o) => o.value === value)?.label ?? placeholder;
  }, [value, options, othersLabel, placeholder]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => o.label.toLowerCase().includes(needle));
  }, [q, options]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border bg-white/70 px-3 py-2 text-left"
      >
        <span className={`truncate ${!value ? "text-muted-foreground" : ""}`}>{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent text-sm outline-none"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {includeNone && (
              <button
                type="button"
                onClick={() => pick("")}
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 ${value === "" ? "bg-slate-50 font-semibold" : ""}`}
              >
                {noneLabel}
              </button>
            )}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => pick(o.value)}
                className={`block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-slate-100 ${value === o.value ? "bg-slate-50 font-semibold" : ""}`}
              >
                {o.label}
              </button>
            ))}
            {!filtered.length && (
              <p className="px-3 py-2 text-xs text-muted-foreground">No matches</p>
            )}
            {includeOthers && (
              <button
                type="button"
                onClick={() => pick("__other")}
                className={`block w-full border-t px-3 py-1.5 text-left text-sm text-sky-600 hover:bg-sky-50 ${value === "__other" ? "bg-sky-50 font-semibold" : ""}`}
              >
                {othersLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
