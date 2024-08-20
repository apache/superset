import { Collapse, Spin } from "antd";
import { DatasourceTableProps } from "./DatasourceTable";
import { DatasourceTable } from "./DatasourceTable";
import React, { Component } from "react";
import { fetchTableData, DatabaseSchemaTableData } from "../contextUtils";

/**
 * Props
 */
export interface DatasourceSchemaProps {
    databaseId: number;
    selected?: boolean;
    schemaName: string;
    description?: string;
    tables?: DatasourceTableProps[];
    onChange?: (data: DatasourceTableProps) => void;
    loading?: boolean;
}

/**
 * DatasourceSchema Component
 */
export class DatasourceSchema extends Component<DatasourceSchemaProps> {

    state: DatasourceSchemaProps = {
        selected: this.props.selected || false,
        tables: this.props.tables || [],
        loading: true,
        ...this.props
    };

    handleSelect = () => {
        this.setState((prevState: DatasourceSchemaProps) => ({
            selected: !prevState.selected
        }));
    };

    async componentDidMount() {
        const { databaseId, schemaName } = this.props;
        const tables = await fetchTableData(databaseId, schemaName);
        const tableData: DatasourceTableProps[] = tables.map((table: DatabaseSchemaTableData) => {
            return {
                databaseId: databaseId,
                schemaName: schemaName,
                selected: false,
                tableName: table.table_name,
                columns: []
            };
        });
        this.setState((prevState: DatasourceSchemaProps) => ({
            tables: tableData,
            loading: false
        }));
    }

    handleOnChange = (data: DatasourceTableProps) => {
        // percentage done
        const { loading } = data
        console.log('Loading: ', loading);
        // finally
        this.state.onChange?.call(this, data);
    };

    

    render() {
        const { loading, schemaName, tables } = this.state;
        return (
            <>
                <div style={{
                    width: '100%',
                    background: '#f0f0f0',
                }}>
                    <Collapse style={{
                        padding: '0px',
                    }}>
                        <Collapse.Panel style={{
                            padding: '0px',
                        }}
                            header={
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                }}>
                                    <span>{schemaName}</span>
                                    <span style={{ width: '10px' }}></span>
                                    {loading && <Spin size="small" />}
                                </div>
                            } key={schemaName}>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'row',
                                flexWrap: 'wrap',
                            }}>
                                {tables?.map((table) => (
                                    <DatasourceTable key={'tables'+table.tableName} {...table} onChange={this.handleOnChange} />
                                ))}
                            </div>
                        </Collapse.Panel>
                    </Collapse>
                </div>
            </>
        );
    }
}