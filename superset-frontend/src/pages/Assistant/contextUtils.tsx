export interface DatabaseContext {
    databases: DatabaseData[];
}

export interface DatabaseData {
    id: number;
    database_name: string;
    tables: DatabaseTableData[];
}

export interface DatabaseTableData {
    table_name: string;
    columns: ColumnData[];
}

export interface ColumnData {
    column_name: string;
    type: string;
    description: string;
}

export const emptyDatabaseContext: DatabaseContext = {
    databases: [],
};
