declare function formatCellValue(i: number, cols: string[], tdText: string, columnFormats: any, numberFormat: string, dateRegex: RegExp, dateFormatter: any): {
    textContent: string;
    sortAttributeValue: any;
};
declare function formatDateCellValue(text: string, verboseMap: any, dateRegex: RegExp, dateFormatter: any): any;
export { formatCellValue, formatDateCellValue };
//# sourceMappingURL=formatCells.d.ts.map