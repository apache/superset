import { SupersetClient } from "@superset-ui/core";


export interface DatabaseContext {
    databases: DatabaseData[];
}

export interface DatabaseData {
    database_id: number;
    database_name: string;
    schemas: DatabaseScemaData[];
}

export interface DatabaseScemaData {
    schema_name: string;
    description?: string;
    tables: DatabaseSchemaTableData[];
}

export interface DatabaseSchemaTableData {
    table_name: string;
    description?: string;
    suggested?: string;
    columns: ColumnData[];
}

export interface ColumnData {
    column_name: string;
    data_type: string;
    description?: string;
    suggested?: string;
}

export const emptyDatabaseContext: DatabaseContext = {
    databases: [],
};

/**
 * TODO
 * 1. Build DatabseContext
 * 1.1 Get all databases
 * 1.2 Get all Schemas for each database
 * 1.3 Get all tables for each schema
 * 1.4 Get all columns for each table
 * 
 */

/**
 * Fetch Database Data
 * @returns Promise<DatabaseData[]>
 */
export const fetchDatabaseData = async () => {
    try {
        const response = await SupersetClient.get({ endpoint: '/api/v1/database/' });
        const databases = await response.json.result.map((database: any) => {
            const databaseId = database.id;
            const database_name = database.database_name;
            // const schemas = await fetchSchemaData(databaseId);
            return {
                database_id: databaseId,
                database_name: database_name,
                // tables: schemas
            };
        });
        return databases;
    } catch (error) {
        console.error("Error fetching database data:", error);
        return [];
    }
}
/**
 * Fetch Schema Data for a given database
 * @param databaseId
 * @returns Promise<DatabaseScemaData>
 */
export const fetchSchemaData = async (databaseId: number) => {
    const enpoint = `/api/v1/database/${databaseId}/schemas/`;
    try {
        const response = await SupersetClient.get({ endpoint: enpoint });
        const schemas = response.json.result.map((schema: any) => {
            const schema_name = schema;
            // const tables = await fetchTableData(databaseId, schema_name);
            return {
                schema_name: schema,
                tables: []
            };
        });
        return schemas;
    } catch (error) {
        console.error("Error fetching schema data:", error);
        return [];
    }
}

/**
 * Fetch Table Data for a given schema
 * @param databaseId
 * @param schemaName
 * @returns Promise<DatabaseSchemaTableData>
 */
export const fetchTableData = async (databaseId: number, schemaName: string) => {
    const params = {
        "force": true,
        "schema_name": schemaName
    }
    const q = encodeURIComponent(JSON.stringify(params));
    const enpoint = `/api/v1/database/${databaseId}/tables/?q=${q}`;
    try {
        const response = await SupersetClient.get({ endpoint: enpoint });
        const tables = response.json.result.map((table: any) => {
           
            // const columns = await fetchColumnData(databaseId, schemaName, table_name);
            return {
                table_name: table.value,
                columns: []
            };
        });
        return tables;
    } catch (error) {
        console.error("Error fetching table data:", error);
        return [];
    }
}

/**
 * Fetch Column Data for a given table
 * @param databaseId 
 * @param schemaName 
 * @param tableName 
 * @returns Promise<ColumnData[]>
 */
const fetchColumnData = async (databaseId: number, schemaName: string, tableName: string) => {
    const enpoint = `/api/v1/database/${databaseId}/table/${tableName}/${schemaName}/`;
    try {
        const response = await SupersetClient.get({ endpoint: enpoint });
        const columns = response.json.columns.map((column: any) => {
            return {
                column_name: column.name,
                type: column.type,
                description: column.comment
            };
        });
        return columns;
    } catch (error) {
        console.error("Error fetching column data:", error);
        return [];
    }
}


export function getDatabaseContext(): DatabaseContext {
    const appContainer = document.getElementById('app');
    const dataBootstrap = appContainer?.getAttribute('data-bootstrap');
    return dataBootstrap ? JSON.parse(dataBootstrap) : emptyDatabaseContext;
}

export function readableColor(hex: string, thresholdBright: number = 150, thresholdDark: number = 140): string {
    // If hex is invalid, return black
    if (!hex || hex.length < 7) {
        return '#000000';
    }

    // Remove the alpha channel if present
    if (hex.length === 9) {
        hex = hex.slice(0, 7);
    }

    // Convert hex to RGB
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    // Calculate brightness
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    console.log('Color: %s, Brightness: %d, Threshold: %d <> %d', hex, brightness, thresholdBright, thresholdDark);

    if (brightness > thresholdBright) {
        return '#000000';
    } else if (brightness < thresholdDark) {
        return '#FFFFFF';
    } else {
        // Adjust color for better contrast
        const adjustColor = (color: number) => Math.min(255, color + 50);
        const adjustedColor = `#${((1 << 24) + (adjustColor(r) << 16) + (adjustColor(g) << 8) + adjustColor(b)).toString(16).slice(1)}`;
        return adjustedColor;
    }
}

export function adjustOpacity(hex: string, opacity: number) {
    const validOpacity = Math.min(1, Math.max(0, opacity));
    // if hex is invalid, return white
    // If hex is invalid, return white
    if (!hex || (hex.length !== 7 && hex.length !== 9)) {
        return '#FFFFFF';
    }

    // Remove the alpha channel if present
    if (hex.length === 9) {
        hex = hex.slice(0, 7);
    }

    //  valid opacity to hex part
    const opacityHex = Math.round(validOpacity * 255).toString(16);
    const opacityHexStr = opacityHex.length === 1 ? `0${opacityHex}` : opacityHex;
    return '#' + hex.slice(1) + opacityHexStr;

}