import Excel from 'exceljs';

export interface ExcelSheet {
  name: string;
  columns: { header: string; key: string; width?: number }[];
  rows: Record<string, any>[];
  summary?: { label: string; value: string | number }[];
}

/**
 * Generate an Excel workbook with one or more sheets.
 * Returns a Buffer.
 */
export async function generateExcelWorkbook(
  sheets: ExcelSheet[],
): Promise<Buffer> {
  const workbook = new Excel.Workbook();
  workbook.creator = 'NINS Hospital Management System';
  workbook.created = new Date();

  for (const sheetDef of sheets) {
    const sheet = workbook.addWorksheet(sheetDef.name);

    // Add columns
    sheet.columns = sheetDef.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width || 20,
    }));

    // Style header row
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1A56DB' },
    };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'left' };

    // Add data rows
    sheetDef.rows.forEach((row) => sheet.addRow(row));

    // Add summary section below the data
    if (sheetDef.summary && sheetDef.summary.length) {
      const startRow = sheet.rowCount + 2;
      sheetDef.summary.forEach((item, idx) => {
        const r = sheet.getRow(startRow + idx);
        r.getCell(1).value = item.label;
        r.getCell(1).font = { bold: true };
        r.getCell(2).value = item.value;
      });
    }

    // Auto-filter on the header row
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheetDef.columns.length },
    };
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
