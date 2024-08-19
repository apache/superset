import { ContextBuilderSteps } from './ContextBuilderSteps';
import { Datasource } from './Datasource';
import {ContextSelection} from './ContextSelection';
import { DatasourceProps } from './Datasource';
import { DatasourceSchemaProps } from './DatasourceSchema';
import { DatasourceTableProps } from './DatasourceTable';

/**
 * Test Data
 */
const testTable: DatasourceTableProps = {
    selected: true,
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
    selected: true,
    schemaName: 'schema1',
    description: 'schema1 description',
    tables: [testTable, testTable, testTable, testTable, testTable, testTable, testTable]
}

const testDatasource: DatasourceProps = {
    selected: true,
    datasourceName: 'datasource1',
    schema: [testSchema, testSchema]
}

const testDatasources = [testDatasource, testDatasource, testDatasource, testDatasource, testDatasource]

export function AssistantContextBuilder(props: any) {
    return (
        // 2x1 grid
        <div style={{
            display: 'flex',
            flexDirection: 'row',
            width: 'fill-available',
        }}>
            <ContextBuilderSteps />
            <div style={{
                width: '100%',
                borderTopRightRadius: '16px',
                borderBottomRightRadius: '16px',
                padding: '24px',
                background: '#f0f0f0',
            }}>
                {testDatasources.map((datasource, index) => (
                    <>
                        <Datasource key={index} {...datasource} />
                        
                    </>
                ))}
                <ContextSelection />
            </div>
        </div>
    )
}