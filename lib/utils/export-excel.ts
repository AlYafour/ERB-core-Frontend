export interface ExportColumn<T> {
  header: string;
  key: keyof T | ((row: T) => string | number | boolean | null | undefined);
  width?: number;
}

/**
 * Export any array of objects to a formatted .xlsx file.
 * XLSX is dynamically imported on first call — not bundled with the initial page load.
 */
export async function exportToExcel<T extends object>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
  sheetName = 'Sheet1',
) {
  const XLSX = await import('xlsx');

  const rows = data.map((row) =>
    columns.map((col) => {
      if (typeof col.key === 'function') return col.key(row) ?? '';
      const v = row[col.key as keyof T];
      return v === null || v === undefined ? '' : (v as unknown as string | number | boolean);
    }),
  );

  const ws = XLSX.utils.aoa_to_sheet([columns.map((c) => c.header), ...rows]);

  ws['!cols'] = columns.map((c) => ({ wch: c.width ?? 20 }));

  const headerRange = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellAddr]) continue;
    ws[cellAddr].s = { font: { bold: true }, fill: { fgColor: { rgb: 'F97316' } } };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Fetch ALL pages of a paginated API and return a flat array.
 */
export async function fetchAllPages<T>(
  fetcher: (page: number, pageSize: number) => Promise<{ results: T[]; next: string | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  while (true) {
    const res = await fetcher(page, pageSize);
    all.push(...res.results);
    if (!res.next) break;
    page++;
    if (page > 200) break;
  }
  return all;
}
