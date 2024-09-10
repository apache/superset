import React, { Component } from 'react';
import { Datasource } from './Datasource';
import { ContextSelection, ContextSelectionProps } from './ContextSelection';
import { DatasourceProps } from './Datasource';
import { Spin } from 'antd';
import { AssistantActionsType } from '../actions';
import { fetchDatabaseData, DatabaseData } from '../contextUtils';


/**
 * Props
 */
export interface DatasourceSelectorProps {
    datasources: DatasourceProps[];
    onChange: (data: DatasourceProps[]) => void;
    actions: AssistantActionsType;
}

export interface DatasourceSelectorState extends DatasourceSelectorProps {
    loading: boolean;
    onChange: (data: DatasourceProps[]) => void
}

export class DatasourceSelector extends Component<DatasourceSelectorProps, DatasourceSelectorState> {
    constructor(props: DatasourceSelectorProps) {
        super(props);
        this.state = {
            ...props,
            loading: false
        };
        console.log("DatasourceSelector Props", props);
        console.log("DatasourceSelector State", this.state);
    }

    async componentDidMount() {
        if (this.state.datasources.length === 0) {
            try {
                this.setState({ loading: true });
                const resp: DatabaseData[] = await fetchDatabaseData();
                const data: DatasourceProps[] = resp.map((database: DatabaseData) => ({
                    id: database.database_id,
                    selected: false,
                    datasourceName: database.database_name,
                    backend: database.backend,
                    schema: [],
                    actions: this.props.actions,
                }));
                this.props.actions.loadDataSourceProps(data);
            } catch (error) {
                console.error('Failed to fetch database data', error);
            } finally {
                this.setState({ loading: false });
            }
        }
    }

    componentDidUpdate(prevProps: Readonly<DatasourceSelectorProps>, prevState: Readonly<DatasourceSelectorState>, snapshot?: any): void {
        console.log("DatasourceSelector Props componentDidUpdate", prevState);
        if (prevProps.datasources !== this.props.datasources) {
            this.setState({ datasources: this.props.datasources });
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
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        padding: '0px',
                        background: '#f0f0f0',
                    }}
                >
                    <div
                        style={{
                            flex: '0 1 auto',
                            display: 'flex',
                            justifyContent: 'space-between',
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
                    <div
                        style={{
                            flex: '1 1 auto',
                            width:'fill-available',
                            height: 'fill-available',
                            overflowY: 'auto',
                        }}
                    >
                        {datasources.map((datasource) => (
                            <Datasource
                                key={'d_source' + datasource.id}
                                {...datasource} actions={this.props.actions}
                                onChange={this.handleSelectEvent}
                            />
                        ))}
                    </div>
                    <div
                    style={{
                        flex: '0 1 auto',
                        alignSelf: 'flex-end',
                    }}
                    >
                    <ContextSelection {...summary} />
                    </div>
                </div>
            </>
        );
    }
}