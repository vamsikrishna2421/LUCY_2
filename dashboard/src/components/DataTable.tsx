import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  /** Cell renderer. */
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  /** Optional fixed/min width class, e.g. "w-40". */
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
}

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

/** Generic, reusable table styled for the LUCY dark surface. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = "No data",
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center text-footnote text-text-muted">
        {empty}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-e1">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border bg-surface-alt">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-caption font-medium uppercase tracking-wide text-text-muted ${
                  alignClass[col.align ?? "left"]
                } ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-divider transition-colors duration-fast last:border-0 hover:bg-surface-alt/60"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-3 text-callout text-text-secondary ${
                    alignClass[col.align ?? "left"]
                  } ${col.className ?? ""}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
