/**
 * Convert Datasource columns to column choices
 */
export default function columnChoices(datasource) {
    return (datasource?.columns
        .map((col) => [
        col.column_name,
        col.verbose_name || col.column_name,
    ])
        .sort((opt1, opt2) => opt1[1].toLowerCase() > opt2[1].toLowerCase() ? 1 : -1) || []);
}
//# sourceMappingURL=columnChoices.js.map