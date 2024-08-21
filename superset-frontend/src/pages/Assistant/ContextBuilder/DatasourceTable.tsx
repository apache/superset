import React, { Component } from "react";
import { Collapse, Table, Spin, Input } from "antd";
import { fetchColumnData, ColumnData } from "../contextUtils";

export interface DatasourceTableProps {
    databaseId: number;
    selected?: boolean;
    schemaName: string;
    tableName: string;
    columns: DatasourceTableColumnProps[];
    selectedColumns?: string[];
    onChange?: (data:DatasourceTableProps) => void;
    loading?: boolean;
    description?: string;
    descriptionFocused?: boolean;
    isDescriptionLoading?: boolean;
}

export interface DatasourceTableColumnProps {
    selected?: boolean;
    key?: React.Key;
    columnName: string;
    columnType: string;
    columnDescription?: string;
    columnSuggestions?: string[];
}

export class DatasourceTable extends Component<DatasourceTableProps, DatasourceTableProps> {
    constructor(props: DatasourceTableProps) {
        super(props);
        this.state = {
            selected: props.selected || false,
            selectedColumns: [],
            loading: true,
            descriptionFocused: false,
            isDescriptionLoading: false,
            ...props,
        };
    }

    handleSelect = () => {
        this.setState((prevState) => ({
            selected: !prevState.selected,
            selectedColumns: prevState.selected ? [] : prevState.columns.map((column) => column.columnName),
            columns: prevState.columns.map((column) => {
                return {
                    ...column,
                    selected: !prevState.selected,
                };
            }),
        }), () => {
            this.state.onChange?.call(this, this.state);
        });
    };

    handleColumnSelect = (selectedColumnNames: string[]) => {
        this.setState((prevState) => {
            const newState = {
                ...prevState,
                selectedColumns: selectedColumnNames,
                selected: selectedColumnNames.length === prevState.columns.length,
                columns: prevState.columns.map((column) => {
                    return {
                        ...column,
                        selected: selectedColumnNames.includes(column.columnName),
                    };
                }),
            };
            return newState
        },()=>{
            this.state.onChange?.call(this, this.state);
        });
        
    };



    async componentDidMount() {
        const { databaseId, schemaName, tableName } = this.props;
        const columns = await fetchColumnData(databaseId, schemaName, tableName);
        const columnData = columns.map((column: ColumnData) => ({
            selected: false,
            key: column.column_name,
            columnName: column.column_name,
            columnType: column.data_type,
        }));
        this.setState({ columns: columnData, loading: false }, () => {this.state.onChange?.call(this, this.state)});
    }

    handleDescriptionFocus = (isFocused:boolean) => {
        this.setState({
            descriptionFocused: isFocused
        });
    };

    handleGenerateDescription = () => {
        this.setState({
            isDescriptionLoading: true
        });
        setTimeout(() => {
            this.setState({
                description: 'This schema contains data related to sales and customers.',
                isDescriptionLoading: false
            });
        }, 2000);
    };

    render() {
        const { databaseId, selected, columns, selectedColumns, loading, description, descriptionFocused, isDescriptionLoading } = this.state;
        const tableColumns = [
            { title: 'Column', dataIndex: 'columnName', key: 'columnName' },
            { title: 'Type', dataIndex: 'columnType', key: 'columnType' },
        ];

        return (
            <Collapse>
                <Collapse.Panel
                    header={
                        <div style={{ display: 'flex', flexDirection: 'row' }}>
                            <input type="checkbox" checked={selected} onChange={this.handleSelect} />
                            <span style={{ width: '10px' }}></span>
                            <span>{this.props.tableName}</span>
                            <span style={{ width: '10px' }}></span>
                            {loading && <Spin size="small" />}
                        </div>
                    }
                    key={databaseId}>
                    <Input 
                                        prefix={
                                            <img height={'20px'} width={'20px'} src="/static/assets/images/assistant_logo_b_w.svg" onClick={this.handleGenerateDescription}/>
                                        }
                                        suffix={
                                            isDescriptionLoading ? <Spin size="small" /> : null
                                        }
                                        placeholder={description || 'What data does this database schema contain?'} 
                                        value={description}
                                        onFocus={()=>{this.handleDescriptionFocus(true)}} 
                                        onBlur={()=>{this.handleDescriptionFocus(false)}}
                                        style={{
                                            
                                            width: '100%',
                                            padding: '10px',
                                            margin: '10px 0px',
                                            borderRadius: '5px',
                                            border: descriptionFocused ? '1px solid #1890ff' : '0px solid #d9d9d9',
                                        }}
                                        />
                    
                    <Table
                        columns={tableColumns}
                        dataSource={columns}
                        rowSelection={{
                            type: 'checkbox',
                            onChange: (selectedRowKeys, selectedRows) => {
                                const selectedColumnNames = selectedRows.map((row) => row.columnName);
                                this.handleColumnSelect(selectedColumnNames);
                            },
                            selectedRowKeys: selectedColumns,
                        }}
                    />
                </Collapse.Panel>
            </Collapse>
        );
    }
}
