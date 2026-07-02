import * as XLSX from "xlsx";

export function exportToExcel<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns?: { key: keyof T; label: string }[],
  sheetName = "Report",
) {
  if (!rows.length) return;
  const cols =
    columns ??
    (Object.keys(rows[0]).map((k) => ({ key: k as keyof T, label: k })) as {
      key: keyof T;
      label: string;
    }[]);
  const data = [
    cols.map((c) => c.label),
    ...rows.map((r) => cols.map((c) => r[c.key] as unknown)),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = cols.map((c) => ({
    wch: Math.max(
      c.label.length,
      ...rows.map((r) => String(r[c.key] ?? "").length),
    ) + 2,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, out);
}

export function exportToCSV<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns?: { key: keyof T; label: string }[],
) {
  if (!rows.length) return;
  const cols =
    columns ??
    (Object.keys(rows[0]).map((k) => ({ key: k as keyof T, label: k })) as {
      key: keyof T;
      label: string;
    }[]);
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [
    cols.map((c) => esc(c.label)).join(","),
    ...rows.map((r) => cols.map((c) => esc(r[c.key])).join(",")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const printPage = () => window.print();
