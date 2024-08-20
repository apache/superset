import{ Datasource } from './Datasource';
import{ ContextSelection } from './ContextSelection';
import { DatasourceProps } from './Datasource';
import { DatasourceSchemaProps } from './DatasourceSchema';
import { DatasourceTableProps } from './DatasourceTable';
import { useMemo, useState } from 'react';
import { fetchDatabaseData, DatabaseData } from '../contextUtils';

/**
 * Test Data
 */
const testTable: DatasourceTableProps = {
    selected: false,
    tableName: 'table1-table1',
    columns: [
        {
            columnName: 'column1-column1',
            columnType: 'int',
            columnDescription: 'column1 description',
            columnSuggestions: ['suggestion1', 'suggestion2']
        },
        {
            columnName: 'column2',
            columnType: 'string',
            columnDescription: 'column2 description',
            columnSuggestions: ['suggestion1', 'suggestion2']
        }
    ]
}

const testSchema: DatasourceSchemaProps = {
    selected: false,
    schemaName: 'schema1',
    description: 'schema1 description',
    tables: [testTable, testTable, testTable, testTable,testTable]
}

const testDatasource: DatasourceProps = {
    id: 1,
    selected: false,
    datasourceName: 'datasource1',
    schema: [testSchema, testSchema]
}

const testDatasources = [testDatasource]

export function DatabaseSelector(){

    const [datasources, setDatasources] = useState<DatasourceProps[]>([])

    useMemo(() => {
        fetchDatabaseData().then((data:DatabaseData[]) => {
            setDatasources(data.map((database: DatabaseData) => {
                return {
                    id: database.database_id,
                    selected: false,
                    datasourceName: database.database_name,
                    schema:[]
                }
            }));
        }).catch((error) => {
            console.error("<<<<>>>> Error fetching database data:", error);
        })
    }, [])


    return (
        <>
        <div style={{
                width: '100%',
                borderTopRightRadius: '16px',
                borderBottomRightRadius: '16px',
                padding: '24px',
                background: '#f0f0f0',
            }}>
                <h4>Databases</h4>
                <p>Choose the Databases you want the assistant to have access to.</p>
                {datasources.map((datasource) => <Datasource key={'d_source'+datasource.id} {...datasource} />)}
                <ContextSelection />
            </div>
        </>
    )
}