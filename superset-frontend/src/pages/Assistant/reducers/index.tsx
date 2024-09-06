import { 
    AssistantActions,
    SelectAssistantSuggestionAction,
    LoadDatabaseDataAction,
    LoadDatabaseSchemaPropsAction,
    LoadDatabaseSchemaTablesAction,
    LoadDatabaseSchemaTableColumnsAction,
    UpdateDatabaseSchemaTableAction
} from '../actions';
import * as ActionTypes from '../actions/types';
import { DatasourceProps } from '../ContextBuilder/Datasource';
import { DatasourceSchemaProps } from '../ContextBuilder/DatasourceSchema';
import { DatasourceTableProps } from '../ContextBuilder/DatasourceTable';


export default function AssistantReducer(
    state = {
        enabled: false,
        data: [],
        selected: null,
    }, 
    action: AssistantActions
){
    
    switch(action.type){
        case ActionTypes.SELECT_SUGGESTION:
            return {
                ...state,
                selected: {
                    ...(action as SelectAssistantSuggestionAction).payload
                },
                enabled: true
            }
        
        case ActionTypes.LOAD_DATASOURCE_PROPS:
            console.log("Action Data", action);
            return {
                ...state,
                data: (action as LoadDatabaseDataAction).payload.data
            }
        case ActionTypes.LOAD_DATABASE_SCHEMA_PROPS:
            let actionData = (action as LoadDatabaseSchemaPropsAction).payload.data;
            console.log("Action Data", actionData, state.data);
            return {
                ...state,
                data: state.data.map((datasource: DatasourceProps) => {
                    actionData.forEach((schema: DatasourceSchemaProps) => {
                        if (datasource.id === schema.databaseId) {
                            datasource.schema.push(schema);
                        }
                    });
                    return datasource;
                })
            }

        case ActionTypes.LOAD_DATABASE_SCHEMA_TABLE_PROPS:
            let tableActionData = (action as LoadDatabaseSchemaTablesAction).payload.data;
            // update state.data.schema.tables
            return {
                ...state,
                data: state.data.map((datasource: DatasourceProps) => {
                    datasource.schema = datasource.schema.map((schema: DatasourceSchemaProps) => {
                        tableActionData.forEach((table: DatasourceTableProps) => {
                            if (schema.schemaName === table.schemaName) {
                                schema.tables.push(table);
                            }
                        });
                        return schema;
                    });
                    return datasource;
                })
            }
        case ActionTypes.LOAD_DATABASE_SCHEMA_TABLE_COLUMNS_PROPS:
            let columnActionData = (action as LoadDatabaseSchemaTableColumnsAction).payload.data;
            let tableToUpdate = (action as LoadDatabaseSchemaTableColumnsAction).payload.table;
            // update state.data.schema.tables.columns
            return {
                ...state,
                data: state.data.map((datasource: DatasourceProps) => {
                    datasource.schema = datasource.schema.map((schema: DatasourceSchemaProps) => {
                        schema.tables = schema.tables.map((table: DatasourceTableProps) => {
                            if (
                                datasource.id === tableToUpdate.databaseId &&
                                schema.schemaName === tableToUpdate.schemaName &&
                                table.tableName === tableToUpdate.tableName
                            ){
                                table.columns = columnActionData;
                            }
                            return table;
                        });
                        return schema;
                    });
                    return datasource;
                })
            }
        
        case ActionTypes.UPDATE_DATABASE_SCHEMA_TABLE_PROPS:
            let updatedTable = (action as UpdateDatabaseSchemaTableAction).payload.data;
            console.log("Updated Table", updatedTable);
            return {
                ...state,
                data: state.data.map((datasource: DatasourceProps) => {
                    datasource.schema = datasource.schema.map((schema: DatasourceSchemaProps) => {
                        schema.tables = schema.tables.map((table: DatasourceTableProps) => {
                            if (
                                datasource.id === updatedTable.databaseId &&
                                schema.schemaName === updatedTable.schemaName &&
                                table.tableName === updatedTable.tableName
                            ){
                                table = updatedTable;
                            }
                            return table;
                        });
                        return schema;
                    });
                    return datasource;
                })
            }
        default:
            return state;
    }
}