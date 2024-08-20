import { Collapse } from "antd";
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
}

/**
 * DatasourceSchema Component
 */
export class DatasourceSchema extends Component<DatasourceSchemaProps> {

    state: DatasourceSchemaProps = {
        selected: this.props.selected || false,
        tables: this.props.tables || [],
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
            console.log("<<<<>>>> Table:", table);
            return {
                selected: false,
                tableName: table.table_name,
                columns: []
            };
        });
        console.log("<<<<>>>> Datasource Tables:", tableData);
        this.setState((prevState: DatasourceSchemaProps) => ({
            tables: tableData
        }));

    }

    render() {
        const { selected, schemaName, tables } = this.state;
        console.log("<<<<>>>> DatasourceSchema Props:", this.state);
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
                                    <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={this.handleSelect} />
                                    {/* tab */}
                                    <span
                                        style={{
                                            width: '10px',
                                        }}></span>
                                    <span>{schemaName}</span>
                                </div>
                            } key="-1">
                            <div style={{
                                display: 'flex',
                                flexDirection: 'row',
                                flexWrap: 'wrap',
                                gap: '10px',
                            }}>
                                {tables?.map((table) => (
                                    <DatasourceTable key={'tables'+table.tableName} {...table} />
                                ))}
                            </div>
                        </Collapse.Panel>
                    </Collapse>
                </div>
            </>
        );
    }
}