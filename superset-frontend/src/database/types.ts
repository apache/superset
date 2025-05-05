export interface QueryExecutePayload {
  client_id: string;
  database_id: number;
  json: boolean;
  runAsync: boolean;
  catalog: string | null;
  schema: string;
  sql: string;
  tmp_table_name: string;
  select_as_cta: boolean;
  ctas_method: string;
  queryLimit: number;
  expand_data: boolean;
}
export interface Column {
  name: string;
  type: string;
  is_dttm: boolean;
  type_generic: number;
  is_hidden: boolean;
  column_name: string;
}
export interface QueryExecuteResponse {
  status: string;
  query_id: string;
  data: any[];
  columns: Column[];
  selected_columns: Column[];
  expanded_columns: Column[];
  query: any;
}

export interface QueryAdhocState {
  isLoading: boolean | null;
  sql: string | null;
  queryResult: QueryExecuteResponse | null;
}
