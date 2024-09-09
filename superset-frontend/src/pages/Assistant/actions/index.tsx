

import * as ActionTypes from './types';
import { DatasourceProps } from '../ContextBuilder/Datasource';
import { DatasourceSchemaProps } from '../ContextBuilder/DatasourceSchema';
import { DatasourceTableProps, DatasourceTableColumnProps } from '../ContextBuilder/DatasourceTable';

export interface AssistantActions {
    type: string;
}

/*************************************************************
 * Assistant Action Selection Payload
 */
export interface SelectAssistantSuggestionAction extends AssistantActions {
    payload: {
        databaseId: string;
        schemaName: string;
        viz_datasources: string[];
        viz_type: string;
        llm_optimized: string; // llm instructions
    };
}

/**
 * Assistant actions sends the selected suggestion to the reducer
 */
const selectAssistantSuggestion = (payload: SelectAssistantSuggestionAction['payload']): SelectAssistantSuggestionAction => {
    return {
        type: ActionTypes.SELECT_SUGGESTION,
        payload
    }
};



/*************************************************************
 * Assistant Load Data Actions.
 * These actions are meant to load store database prop data
 */

// Datasources
export interface LoadDatabaseDataAction extends AssistantActions {
    payload: {
        data: DatasourceProps[];
    }
}

const loadDataSourceProps = (data: DatasourceProps[]) => {
    console.log("LOAD_DATABASE_DATA Loading database data", data);
    const action: LoadDatabaseDataAction = {
        type: ActionTypes.LOAD_DATASOURCE_PROPS,
        payload: {
            data
        }
    };
    return action;
}

// Datasource Schemas
export interface LoadDatabaseSchemaPropsAction extends AssistantActions {
    payload: {
        data: DatasourceSchemaProps[];
    }
}

const loadDatabaseSchemaProps = (data: DatasourceSchemaProps[]) => {
    console.log("LOAD_DATABASE_SCHEMA_PROPS Loading database schema data", data);
    const action: LoadDatabaseSchemaPropsAction = {
        type: ActionTypes.LOAD_DATABASE_SCHEMA_PROPS,
        payload: {
            data
        }
    };
    return action;
};

export interface ClearDatabaseSchemaTablePropsAction extends AssistantActions {
    payload: {
        data: DatasourceSchemaProps;
    }
}

const clearDatabaseSchemaTableProps = (data: DatasourceSchemaProps) => {
    console.log("CLEAR_DATABASE_SCHEMA_TABLE_PROPS Clearing database schema table data");
    const action: ClearDatabaseSchemaTablePropsAction = {
        type: ActionTypes.CLEAR_DATABASE_SCHEMA_TABLE_PROPS,
        payload: {
            data
        }
    };
    return action;
};

// Datasource Schema Tables
export interface LoadDatabaseSchemaTablesAction extends AssistantActions {
    payload: {
        data: DatasourceTableProps[];
    }
}

const loadDatabaseSchemaTables = (data: DatasourceTableProps[]) => {
    console.log("LOAD_DATABASE_SCHEMA_TABLES Loading database schema tables data", data);
    const action: LoadDatabaseSchemaTablesAction = {
        type: ActionTypes.LOAD_DATABASE_SCHEMA_TABLE_PROPS,
        payload: {
            data
        }
    };
    return action;
};

// Datasource Schema Tables Columns
export interface LoadDatabaseSchemaTableColumnsAction extends AssistantActions {
    payload: {
        table: DatasourceTableProps;
        data: DatasourceTableColumnProps[];
    }
};

const loadDatabaseSchemaTableColumns = (table: DatasourceTableProps ,data: DatasourceTableColumnProps[]) => {
    console.log("LOAD_DATABASE_SCHEMA_TABLE_COLUMNS Loading database schema tables columns data", data);
    const action: LoadDatabaseSchemaTableColumnsAction = {
        type: ActionTypes.LOAD_DATABASE_SCHEMA_TABLE_COLUMNS_PROPS,
        payload: {
            table,
            data
        }
    };
    return action;
};


export interface ClearDatabaseSchemaTableColumnsAction extends AssistantActions {
    payload: {
        table: DatasourceTableProps;
    }
};

const clearDatabaseSchemaTableColumns = (table: DatasourceTableProps) => {
    console.log("CLEAR_DATABASE_SCHEMA_TABLE_COLUMNS Clearing database schema table columns data");
    const action: ClearDatabaseSchemaTableColumnsAction = {
        type: ActionTypes.CLEAR_DATABASE_SCHEMA_TABLE_COLUMNS_PROPS,
        payload: {
            table
        }
    };
    return action;
};


export interface UpdateDatabaseSchemaTableAction extends AssistantActions {
    payload: {
        data: DatasourceTableProps;
    }
};

const updateDatabaseSchemaTable = (data: DatasourceTableProps) => {
    console.log("UPDATE_DATABASE_SCHEMA_TABLE_PROPS Updating database schema table data", data);
    const action: UpdateDatabaseSchemaTableAction = {
        type: ActionTypes.UPDATE_DATABASE_SCHEMA_TABLE_PROPS,
        payload: {
            data
        }
    };
    return action;
};

export const actions = {
    selectAssistantSuggestion,
    loadDataSourceProps,
    loadDatabaseSchemaProps,
    loadDatabaseSchemaTables,
    clearDatabaseSchemaTableProps,
    loadDatabaseSchemaTableColumns,
    updateDatabaseSchemaTable,
    clearDatabaseSchemaTableColumns
};

export type AssistantActionsType = typeof actions;
