import React, { Component } from "react";
import { Collapse, Table, Spin, Input, Modal } from "antd";
import { fetchColumnData, ColumnData, getSelectStarQuery, executeQuery } from "../contextUtils";
import { getTableDescription } from "../assistantUtils";
import FilterableTable from "src/components/FilterableTable";
import { AssistantActionsType } from '../actions';

const { TextArea } = Input;

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
    descriptionExtra?: string;
    selectStarQuery?: string;
    data?: Record<string, unknown>[];
    query?: any;
    actions: AssistantActionsType;
}

export interface DatasourceTableState extends DatasourceTableProps {
    loading: boolean;
    isOpen: boolean;
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

export class DatasourceTable extends Component<DatasourceTableProps, DatasourceTableState> {
    constructor(props: DatasourceTableProps) {
        super(props);
        this.state = {
            ...props,
            selected: props.selected || false,
            selectedColumns: props.selectedColumns || [],
            loading: false,
            descriptionFocused: false,
            isDescriptionLoading: false,
            isOpen: false,
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
            }, () => { this.props.actions.updateDatabaseSchemaTable(this.state) });
            return;
        }
        const selectStarQuery = await getSelectStarQuery(databaseId, tableName, schemaName);
        const tableData = await executeQuery(databaseId, schemaName, selectStarQuery);
        this.setState({
            loading: false,
            selectStarQuery: selectStarQuery,
            data: tableData?.results?.data || [],
            query: tableData?.results?.query,
        }, () => { this.props.actions.updateDatabaseSchemaTable(this.state) })
    };



    async componentDidMount() {
        console.log("DatasourceTable Props componentDidMount", this.props);
        const { databaseId, schemaName, tableName, columns } = this.props;
        if (columns.length === 0) {
            this.setState({ loading: true });
            const columnData = (await fetchColumnData(databaseId, schemaName, tableName)).map((column: ColumnData) => ({
                selected: false,
                key: column.column_name,
                columnName: column.column_name,
                columnType: column.data_type,
            }));
            this.props.actions.loadDatabaseSchemaTableColumns(this.props, columnData);
            this.setState({ loading: false });
        }

    }

    componentDidUpdate(prevProps: Readonly<DatasourceTableProps>, prevState: Readonly<DatasourceTableProps>, snapshot?: any): void {
        console.log("DatasourceTable Props componentDidUpdate", this.props);
        if (prevProps.columns !== this.props.columns) {
            this.setState({ columns: this.props.columns });
        }
    }

    handleDescriptionFocus = (isFocused: boolean) => {
        this.setState({
            descriptionFocused: isFocused
        }, () => { this.state.onChange?.call(this, this.state) });
    };

    handleGenerateDescription = async () => {
        this.setState({
            isDescriptionLoading: true
        });
        await this.loadTableData();
        const descriptions = await getTableDescription(this.state, this.state.tableName);
        this.setState({
            description: descriptions.human_understandable,
            descriptionExtra: descriptions.llm_optimized,
            isDescriptionLoading: false
        }, () => { this.props.actions.updateDatabaseSchemaTable(this.state) });

    };

    handleDescriptionInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        console.log("Description Input", e.target.value);
        this.setState({
            description: e.target.value
        }, () => { this.props.actions.updateDatabaseSchemaTable(this.state) });
    };


    handleOpen = () => {
        console.log("Opening Modal");
        this.setState({
            isOpen: true
        })
    };

    handleClose = () => {
        this.setState({
            isOpen: false
        })
    };

    render() {
        const { selected, columns, selectedColumns, loading, description, descriptionFocused, isDescriptionLoading, data, query, isOpen } = this.state;
        const tableColumns = [
            { title: 'Column', dataIndex: 'columnName', key: 'columnName' },
            { title: 'Type', dataIndex: 'columnType', key: 'columnType' },
        ];

        return (
            <div>

            <div style={{ 
                display: 'flex', 
                flexDirection: 'row', 
                padding: '10px',
                border: '1px solid #d9d9d9',
                borderRadius: '5px',
                marginRight: '10px',
                marginBottom: '10px',
                }} onClick={this.handleOpen} >
                <span style={{ width: '10px' }}></span>
                <input type="checkbox" checked={selected} onChange={this.handleSelect} disabled={loading || columns.length === 0} />
                <span style={{ width: '10px' }}></span>
                <span>{this.props.tableName}</span>
                <span style={{ width: '10px' }}></span>
                <span>
                    {description ? ' ✅ ' : ' ? '}
                </span>
                {loading && <Spin size="small" />}
                
            </div>
            <Modal
                    title={
                        <div>
                            <input type="checkbox" checked={selected} onChange={this.handleSelect} disabled={loading || columns.length === 0} />
                            <p>{this.props.tableName}</p>
                        </div>                        
                    }
                    visible={isOpen}
                    onCancel={this.handleClose}
                    onOk={this.handleClose}
                    width="80%"
                >

                    <div style={{
                        position: 'relative'
                    }}>
                        {/* assistant logo in top right */}
                        {/* loading icon in top left */}
                        <img style={{
                            right: '10px',
                            top: '10px'
                        }} height={'20px'} width={'20px'} src="/static/assets/images/assistant_logo_b_w.svg" onClick={this.handleGenerateDescription} />
                        {isDescriptionLoading ? <Spin style={{
                            left: '10px',
                            top: '10px'
                        }} size="small" /> : null}
                        <TextArea
                            placeholder={description || 'What data does this database schema contain?'}
                            value={description}
                            onFocus={() => { this.handleDescriptionFocus(true) }}
                            onBlur={() => { this.handleDescriptionFocus(false) }}
                            style={{
                                height: 'auto',
                                width: '100%',
                                padding: '10px',
                                margin: '10px 0px',
                                borderRadius: '5px',
                                border: descriptionFocused ? '1px solid #1890ff' : '0px solid #d9d9d9',
                            }}
                            onChange={this.handleDescriptionInput}
                            autoSize={true}
                        />

                    </div>


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
                    <div style={{
                        position: 'relative',
                        overflow: 'scroll',
                    }}>

                        
                    </div>

                    {(query && data && columns.length > 0) && <FilterableTable {...{
                            orderedColumnKeys: columns.map((column) => column.columnName).sort(),
                            data: data,
                            height: 200,
                            filterText: '',
                            expandedColumns: [],
                            allowHTML: true
                        }} />}

                </Modal>
            </div>
            
        );
    }
}
