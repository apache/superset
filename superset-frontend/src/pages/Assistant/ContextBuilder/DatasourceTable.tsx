import React from "react";
import { Collapse, Table } from "antd";

export interface DatasourceTableProps {
    selected?: boolean;
    tableName: string;
    columns: DatasourceTableColumnProps[];
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
        ...this.props,
    };

    handleSelect = () => {
        this.setState((prevState: DatasourceTableProps) => ({
            selected: !prevState.selected,
        }));
    };
    
    render() {
        const columns = [{
            title: 'Column',
            dataIndex: 'columnName',
            key: 'columnName',
        }, {
            title: 'Type',
            dataIndex: 'columnType',
            key: 'columnType',
        }];

        const { selected } = this.state;

        return (
            <div style={{
                width: 'fit-content',
                maxWidth: '300px',
            }} >
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
                        <Table  columns={columns} dataSource={this.props.columns} rowSelection={{ }} />
                    </Collapse.Panel>
                </Collapse>
            </div>
        );
    }
}
