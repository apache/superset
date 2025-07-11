import * as XLSX from 'xlsx';

export default function exportPivotExcel(tableSelector: string, fileName: string) {
  const table = document.querySelector(tableSelector);
  const workbook = XLSX.utils.table_to_book(table);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}