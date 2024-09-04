import React, { Component } from 'react';
import { Datasource } from './Datasource';
import { ContextSelection, ContextSelectionProps } from './ContextSelection';
import { DatasourceProps } from './Datasource';
import { fetchDatabaseData, DatabaseData } from '../contextUtils';
import { Spin } from 'antd';

/**
 * Props
 */
export interface DatasourceSelectorProps {
    onChange: (data: DatasourceProps[]) => void;
}

export interface DatasourceSelectorState {
    datasources: DatasourceProps[];
    loading: boolean;
}

export class DatasourceSelector extends Component<DatasourceSelectorProps, DatasourceSelectorState> {
    constructor(props: DatasourceSelectorProps) {
        super(props);
        this.state = {
            datasources: [],
            loading: true,
        };
    }

    async componentDidMount() {
        try {
            const data: DatabaseData[] = await fetchDatabaseData();
            const datasources = data.map((database: DatabaseData) => ({
                id: database.database_id,
                selected: false,
                datasourceName: database.database_name,
                backend: database.backend,
                schema: [],
            }));
            this.setState({ datasources });
        } catch (error) {
            console.error("<<<<>>>> Error fetching database data:", error);
        } finally {
            this.setState({ loading: false });
        }
    }

    handleSelectEvent = (data: DatasourceProps) => {
        this.setState((prevState) => {
            const updated = prevState.datasources.map((datasource) =>
                datasource.id === data.id ? data : datasource
            );

            const selectedDatasources = updated.filter((datasource) =>
                datasource.schema.some((schema) =>
                    (schema.tables || []).some((table) => (table.selectedColumns || []).length > 0)
                )
            );

            this.props.onChange(selectedDatasources);
            return { datasources: updated };
        });
    };

    render() {
        const { datasources, loading } = this.state;
        const summary: ContextSelectionProps = {
            numDataSources: datasources.length,
            numSchemas: datasources.reduce((acc, datasource) => acc + datasource.schema.length, 0),
            numTables: datasources.reduce(
                (acc, datasource) =>
                    acc +
                    datasource.schema.reduce(
                        (acc, schema) => acc + (schema.tables || []).length,
                        0
                    ),
                0
            ),
            numColumns: datasources.reduce(
                (acc, datasource) =>
                    acc +
                    datasource.schema.reduce(
                        (acc, schema) =>
                            acc +
                            (schema.tables || []).reduce(
                                (acc, table) => acc + (table.selectedColumns || []).length,
                                0
                            ),
                        0
                    ),
                0
            ),
        };

        return (
            <>
                <div
                    style={{
                        width: '100%',
                        // borderTopRightRadius: '16px',
                        // borderBottomRightRadius: '16px',
                        padding: '0px',
                        background: '#f0f0f0',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '24px',
                            width: '100%',
                        }}
                    >
                        <div
                            style={{
                                padding: '24px',
                                width: 'fit-content',
                                height: 'fit-content',
                            }}
                        >
                            <h4>Databases Connections</h4>
                            <p>Choose the Databases you want the assistant to have access to.</p>
                        </div>
                        <div style={{}}>
                            {/* Loading Indicator */}
                            {loading && <Spin size="small" />}
                        </div>
                    </div>
                    {datasources.map((datasource) => (
                        <Datasource
                            key={'d_source' + datasource.id}
                            {...datasource}
                            onChange={this.handleSelectEvent}
                        />
                    ))}
                    <ContextSelection {...summary} />
                </div>
            </>
        );
    }
}