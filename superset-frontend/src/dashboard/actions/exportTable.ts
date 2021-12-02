export default function exportTableToExcel(tables: any, filename = '') {
  const table = document.createElement('table');

  for (let i = 0; i < tables.length; i += 1) {
    const secTable = tables[i].cloneNode(true);
    for (let j = 0; j < secTable.children.length; j += 1) {
      table.appendChild(secTable.children[j].cloneNode(true));
    }
  }

  const tableHTML = table.outerHTML
    .replace('<tfoot>', '')
    .replace('</tfoot>', '');

  const uri = 'data:application/vnd.ms-excel;base64,';
  const template = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"><head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>{worksheet}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>${tableHTML}</body></html>`;
  // eslint-disable-next-line func-names
  const base64 = function (s: any) {
    return window.btoa(unescape(encodeURIComponent(s)));
  };
  // eslint-disable-next-line func-names
  const format = function (s: any, c: any) {
    return s.replace(/{(\w+)}/g, (m: any, p: any) => c[p]);
  };

  // Create download link element
  const downloadLink = document.createElement('a');
  const ctx = { worksheet: 'Лист', table: tableHTML };
  downloadLink.href = uri + base64(format(template, ctx));
  downloadLink.download = `${filename || 'exportedTable'}.xls`;

  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}
