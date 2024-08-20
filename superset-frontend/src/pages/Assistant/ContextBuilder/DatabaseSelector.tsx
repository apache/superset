import{ Datasource } from './Datasource';
import{ ContextSelection } from './ContextSelection';
import { DatasourceProps } from './Datasource';
import { DatasourceTableProps } from "./DatasourceTable";
import { useEffect, useMemo, useState } from 'react';
import { fetchDatabaseData, DatabaseData } from '../contextUtils';
import { Spin } from 'antd';



export function DatabaseSelector(){

    const [datasources, setDatasources] = useState<DatasourceProps[]>([])
    const [loading, setLoading] = useState<boolean>(true);

    // selectedDict is a dictionary that stores the selected data
    const [ selectedDict, setSelectedDict ] = useState<{ [key: number]: any }>({});

    useEffect(() => {
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
    }, [selectedDict])

    const handleSelectEvent = (data: DatasourceTableProps) => {
        setSelectedDict((prevState) => {
            let newState = {
                ...prevState,
                [data.databaseId]: (data.selectedColumns || []).length > 0 ? {
                    ...prevState[data.databaseId],
                    [data.schemaName]:{
                        ...prevState[data.databaseId]?.[data.schemaName],
                        [data.tableName]: data.columns.filter((column) => {
                            return data.selectedColumns?.includes(column.columnName);
                        }).map((column) => {
                            return {
                                column_name: column.columnName,
                                column_type: column.columnType,
                            }
                        })
                    }
                } : null
            }
            // remove the key if the value is null
            if (newState[data.databaseId] === null) {
                delete newState[data.databaseId];
            }
            console.log("<<<<>>>> Selected Data: ", newState);
            return newState;
        });
    };


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