import{ Datasource } from './Datasource';
import{ ContextSelection } from './ContextSelection';
import { DatasourceProps } from './Datasource';
import { useMemo, useState } from 'react';
import { fetchDatabaseData, DatabaseData } from '../contextUtils';
import { Spin } from 'antd';

/**
 * Props
 */

interface DatasourceSelectorProps {
    onChange: (data: DatasourceProps[]) => void;
}


export function DatasourceSelector(props: DatasourceSelectorProps) {

    const [datasources, setDatasources] = useState<DatasourceProps[]>([])
    const [loading, setLoading] = useState<boolean>(true);

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
        }).finally(() => {
            setLoading(false);
        });
        console.log("<<<<>>>> Datasources: ", datasources);
    }, [])

    const handleSelectEvent = (data: DatasourceProps) => {
        setDatasources((prevDatasources) => {
            
            const updated = prevDatasources.map((datasource) => {
                return datasource.id === data.id ? data : datasource;
            });
            
            // filter out where [].schema.tables.selectedColumns.length > 0
            const selectedDatasources = updated.filter((datasource) => {
                return datasource.schema.filter((schema) => {
                    return (schema.tables || []).filter((table) => {
                        return (table.selectedColumns || []).length > 0;
                    }).length > 0;
                }).length > 0
            });
            props.onChange(selectedDatasources);
            return updated;
        });
    };

    /**
     * return data schema
     * {
     *      databaseId: number,
     *      databaseName: string,
     *      description: string,
     *      schemas: [
     *         {
     *             schemaName: string,
     *             description: string,
     *             tables: [
     *                  {
     *                    tableName: string,
     * 
     *                  }
     *              ]
     *          }
     *     ]
     * }
     */


    return (
        <>
        <div style={{
                width: '100%',
                borderTopRightRadius: '16px',
                borderBottomRightRadius: '16px',
                padding: '0px',
                background: '#f0f0f0',
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '24px',
                    width: '100%',
                    background: '#f0f0f0',
                }}>
                    <div style={{
                        padding: '24px',
                        width: 'fit-content',
                        height: 'fit-content',
                    }}>
                        <h4>Databases Connections</h4>
                        <p>Choose the Databases you want the assistant to have access to.</p>
                    </div>
                    <div style={{}}>
                        {/* Loading Indicator */}
                        {loading && <Spin size="small" />}

                    </div>
                </div>
                {datasources.map((datasource) => <Datasource key={'d_source'+datasource.id} {...datasource} onChange={handleSelectEvent} />)}
                <ContextSelection />
            </div>
        </>
    )
}