import React from "react";
import { Collapse, Table } from "antd";
import { fetchColumnData, ColumnData } from "../contextUtils";

export interface DatasourceTableProps {
    databaseId: number;
    selected?: boolean;
    schemaName: string;
    tableName: string;
    columns: DatasourceTableColumnProps[];
    selectedColumns?: string[];
}

export interface DatasourceTableColumnProps {
    selected?: boolean;
    columnName: string;
    columnType: string;
    columnDescription?: string;
    columnSuggestions?: string[];
}

// rounded card with checkbox followed by table name
export class DatasourceTable extends React.Component<DatasourceTableProps> {
    
    state: DatasourceTableProps = {
        selected: this.props.selected || false,
        selectedColumns: [],
        ...this.props,
    };

    handleSelect = () => {
        this.setState((prevState: DatasourceTableProps) => ({
            selected: !prevState.selected,
        }));
    };

    handleColumnSelect = (columnName: string) => {
        this.setState((prevState: DatasourceTableProps) => {
            const selectedColumns = prevState.selectedColumns || [];
            const index = selectedColumns.indexOf(columnName);
            if (index > -1) {
                selectedColumns.splice(index, 1);
            } else {
                selectedColumns.push(columnName);
            }
            return {
                selectedColumns,
            };
        });
    };

    async componentDidMount() {
        const { databaseId, schemaName, tableName } = this.props;
        const columns = await fetchColumnData(databaseId, schemaName, tableName);
        console.log("<<<<>>>> Columns:", columns);
        const columnData: DatasourceTableColumnProps[] = columns.map((column: ColumnData) => {
            return {
                selected: false,
                columnName: column.column_name,
                columnType: column.data_type,
            };
        });
        this.setState((prevState: DatasourceTableProps) => ({
            columns: columnData,
        }));

    }
    
    render() {
        const columnsMap = [{
            title: 'Select',
            dataIndex: 'columnName',
            key: 'selected',
            render: (columnName: string) => {
                return <input type="checkbox" 
                    checked={ this.state.selectedColumns?.includes(columnName) } 
                    onChange={() => this.handleColumnSelect(columnName)}
                />;
            }
        },{
            title: 'Column',
            dataIndex: 'columnName',
            key: 'columnName',
        }, {
            title: 'Type',
            dataIndex: 'columnType',
            key: 'columnType',
        }];

        const { selected, columns } = this.state;

        console.log("<<<<>>>> DatasourceTable Props:", this.state);

        return (
            <div style={{
                width: 'fit-content',
                
            }} >
                {/* <Collapse  /> */}
                <Collapse style={{
                    padding: '0px',
                }} >
                    <Collapse.Panel style={{
                        padding: '0px',
                    }} header={
                        <div style={{
                            display: 'flex',
                            flexDirection: 'row',
                        }}>
                            <input type="checkbox" checked={selected} onChange={this.handleSelect}  />
                            {/* tab */}
                            <span style={{
                                width: '10px',
                            }} ></span>
                            <span>{this.props.tableName}</span>
                        </div>
                    } key="-1">
                        <Table  
                            columns={columnsMap} 
                            dataSource={columns}  
                          
                            />
                    </Collapse.Panel>
                </Collapse>
            </div>
        );
    }
}
