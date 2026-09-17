/**
 * Utility to export session history rows as CSV in-memory using Blob and URL.createObjectURL.
 */

export interface SessionExportRow {
  id: string;
  date: string;
  text_title: string;
  wpm: number;
  accuracy: number;
  errors: number;
  duration_seconds: number;
  xp_earned: number;
}

export function generateCsvContent(rows: SessionExportRow[]): string {
  const headers = [
    "date",
    "text_title",
    "wpm",
    "accuracy",
    "errors",
    "duration_seconds",
    "xp_earned",
  ];

  const escapeCsv = (str: string) => {
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = [headers.join(",")];

  for (const row of rows) {
    const values = [
      escapeCsv(row.date),
      escapeCsv(row.text_title),
      row.wpm.toString(),
      row.accuracy.toString(),
      row.errors.toString(),
      row.duration_seconds.toString(),
      row.xp_earned.toString(),
    ];
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}

export function downloadSessionsCsv(rows: SessionExportRow[], filename = "mch_session_history.csv"): void {
  if (typeof window === "undefined") return;

  const content = generateCsvContent(rows);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
