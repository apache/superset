export interface InputColumn {
  key: string;
  label: string;
  dataType: number;
  isNumeric: boolean;
  isMetric: boolean;
  isPercentMetric: boolean;
  config: Record<string, any>;
}

interface InputData {
  [key: string]: any;
}

export const transformData = (columns: InputColumn[], data: InputData[]) => {
  // Transform columns to AG Grid format
  const colDefs = columns.map(col => ({
    field: col.key,
    headerName: col.label,
    sortable: true,
    filter: true,
    // Add number specific properties for numeric columns
    ...(col.isNumeric && {
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      cellDataType: 'number',
    }),
  }));

  // Default column definition
  const defaultColDef = {
    flex: 1,
    filter: true,
    enableRowGroup: true,
    enableValue: true,
    sortable: true,
    resizable: true,
    minWidth: 100,
  };

  return {
    rowData: data,
    colDefs,
    defaultColDef,
  };
};
