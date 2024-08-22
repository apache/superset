import React, { Component } from "react";
import { Collapse, Table, Spin, Input } from "antd";
import { fetchColumnData, ColumnData, getSelectStarQuery, executeQuery } from "../contextUtils";

export interface DatasourceTableProps {
    databaseId: number;
    datasourceName: string;
    selected?: boolean;
    schemaName: string;
    tableName: string;
    columns: DatasourceTableColumnProps[];
    selectedColumns?: string[];
    onChange?: (data: DatasourceTableProps) => void;
    loading?: boolean;
    description?: string;
    descriptionFocused?: boolean;
    isDescriptionLoading?: boolean;
    selectStarQuery?: string;
    data?: any;
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
            ...prevState,
            selected: !prevState.selected,
            selectedColumns: prevState.selected ? [] : prevState.columns.map((column) => column.columnName),
            columns: prevState.columns.map((column) => {
                return {
                    ...column,
                    selected: !prevState.selected,
                };
            }),
        }), () => {
            this.loadTableData();
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
        }, () => {
            this.loadTableData();
        });
        
    };

    loadTableData = async () => {
        this.setState({
            loading: true
        });
        const { databaseId, tableName, schemaName, data } = this.state;
        if (data) {
            this.setState({
                loading: false,
                data: data
            },()=>{this.state.onChange?.call(this, this.state);});
            return;
        }
        const selectStarQuery = await getSelectStarQuery( databaseId, tableName, schemaName);
        const tableData = await executeQuery(databaseId, schemaName, selectStarQuery);
        this.setState({
            loading: false,
            selectStarQuery: selectStarQuery,
            data: tableData,
        },()=>{this.state.onChange?.call(this, this.state);})
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

        

        this.setState({ columns: columnData, loading: false });
    }

    handleDescriptionFocus = (isFocused: boolean) => {
        this.setState({
            descriptionFocused: isFocused
        },() => { this.state.onChange?.call(this, this.state) });
    };

    handleGenerateDescription = () => {
        this.setState({
            isDescriptionLoading: true
        },() => { this.state.onChange?.call(this, this.state) });
        setTimeout(() => {
            this.setState({
                description: 'This schema contains data related to sales and customers.',
                isDescriptionLoading: false
            }, () => { this.state.onChange?.call(this, this.state) });
        }, 2000);
    };

    handleDescriptionInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({
            description: e.target.value
        },() => { this.state.onChange?.call(this, this.state) });
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
                            <input type="checkbox" checked={selected} onChange={this.handleSelect} disabled={loading || columns.length === 0 } />
                            <span style={{ width: '10px' }}></span>
                            <span>{this.props.tableName}</span>
                            <span style={{ width: '10px' }}></span>
                            <span>
                                {description ? '✅' : '?'}
                            </span>
                            {loading && <Spin size="small" />}
                        </div>
                    }
                    key={databaseId}>
                    <Input
                        prefix={
                            <img height={'20px'} width={'20px'} src="/static/assets/images/assistant_logo_b_w.svg" onClick={this.handleGenerateDescription} />
                        }
                        suffix={
                            isDescriptionLoading ? <Spin size="small" /> : null
                        }
                        placeholder={description || 'What data does this database schema contain?'}
                        value={description}
                        onFocus={() => { this.handleDescriptionFocus(true) }}
                        onBlur={() => { this.handleDescriptionFocus(false) }}
                        style={{

                            width: '100%',
                            padding: '10px',
                            margin: '10px 0px',
                            borderRadius: '5px',
                            border: descriptionFocused ? '1px solid #1890ff' : '0px solid #d9d9d9',
                        }}
                        onChange={this.handleDescriptionInput}
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
