import { Collapse, Spin, Input, Button, Modal } from "antd";
import { DatasourceTableProps } from "./DatasourceTable";
import { DatasourceTable } from "./DatasourceTable";
import React, { Component } from "react";
import { fetchTableData, DatabaseSchemaTableData } from "../contextUtils";
import { AssistantActionsType } from '../actions';

/**
 * Props
 */
export interface DatasourceSchemaProps {
    databaseId: number;
    datasourceName: string;
    selected?: boolean;
    schemaName: string;
    description?: string;
    tables: DatasourceTableProps[];
    onChange?: (data: DatasourceSchemaProps) => void;
    loading?: boolean;
    descriptionFocused?: boolean;
    isDescriptionLoading?: boolean;
    tablesToShow?: number;
    actions: AssistantActionsType;
}

interface DatasourceSchemaState extends DatasourceSchemaProps {
    confirmRefreshModalVisible: boolean;
}

/**
 * DatasourceSchema Component
 */
export class DatasourceSchema extends Component<DatasourceSchemaProps, DatasourceSchemaState> {

    constructor(props: DatasourceSchemaProps) {
        super(props);
        this.state = {
            ...props,
            selected: props.selected || false,
            loading: false,
            descriptionFocused: false,
            isDescriptionLoading: false,
            tablesToShow: 15,
            confirmRefreshModalVisible: false
        };
    }

    handleSelect = () => {
        this.setState((prevState: DatasourceSchemaProps) => ({
            selected: !prevState.selected
        }));
    };


    async getDatasourceTableProps() {
        const { databaseId, schemaName, datasourceName } = this.props;
        const tableData: DatasourceTableProps[] = (await fetchTableData(databaseId, schemaName)).map((table: DatabaseSchemaTableData) => {
            return {
                databaseId: databaseId,
                datasourceName: datasourceName,
                schemaName: schemaName,
                selected: false,
                tableName: table.table_name,
                columns: [],
                actions: this.props.actions
            };
        });
        this.props.actions.loadDatabaseSchemaTables(tableData);
    }

    // Refetch tables data and restore selection for by table name
    handleRefresh = async () => {
        this.setState({ 
            loading: true,
            confirmRefreshModalVisible: false
        });
        this.props.actions.clearDatabaseSchemaTableProps(this.props);
        await this.getDatasourceTableProps();
        this.setState({ loading: false });
    };

    async componentDidMount() {
        const {tables } = this.props;
        console.log("DatasourceSchema Props componentDidMount ", this.props);
        if (tables?.length === 0) {
            this.handleRefresh();
        }
    }


    openRefreshModal = () => {
        this.setState({
            confirmRefreshModalVisible: true
        });
    };

    closeRefreshModal = () => {
        this.setState({
            confirmRefreshModalVisible: false
        });
    };
    

    componentDidUpdate(prevProps: Readonly<DatasourceSchemaProps>, prevState: Readonly<DatasourceSchemaProps>, snapshot?: any): void {
        console.log("DatasourceSchema Props componentDidUpdate", prevState);
        if (prevProps.tables !== this.props.tables) {
            this.setState({ tables: this.props.tables });
        }
    }

    handleOnChange = (data: DatasourceTableProps) => {
        //update the state
        this.setState((prevState: DatasourceSchemaProps) => {
            const newState = {
                ...prevState,
                tables: prevState.tables?.map((table) => {
                    if (table.tableName === data.tableName) {
                        return data;
                    }
                    return table;
                })
            };
            return newState;
        }, () => {
            // filter out where [].tables.selectedColumns.length > 0
            const filteredState = {
                ...this.state,
                tables: this.state.tables?.filter((table) => {
                    return table.selectedColumns;
                })
            }
            this.state.onChange?.call(this, filteredState);
        });
    };

    handleDescriptionFocus = (isFocused: boolean) => {
        this.setState({
            descriptionFocused: isFocused
        });
    };

    handleGenerateDescription = () => {
        this.setState({
            isDescriptionLoading: true
        });
        setTimeout(() => {
            this.setState((prevState) => {
                return {
                    description: 'This schema contains data related to sales and customers.',
                    isDescriptionLoading: false
                }
            });
        }, 2000);
    };


    loadMoreTables = () => {
        this.setState((prevState) => {
            return {
                tablesToShow: (prevState.tablesToShow || 15) + 15
            };
        });
    };

    render() {
        const { loading, schemaName, tables, description, descriptionFocused, isDescriptionLoading, tablesToShow } = this.state;
        const tablesToDisplay = tables?.slice(0, tablesToShow);
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

                                }} >
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'row',
                                    }}>
                                        <span>{schemaName}</span>
                                        <span style={{ width: '10px' }}></span>
                                        <span>
                                            {description ? '✅' : '?'}
                                        </span>
                                        {loading && <Spin size="small" />}
                                    </div>
                                    <div>
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
                                        />
                                    </div>
                                </div>

                            } key={schemaName}>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'row',
                                flexWrap: 'wrap',
                                gap: 'px',
                            }}>
                                {tablesToDisplay?.map((table) => (
                                    <DatasourceTable key={'tables' + table.tableName} {...table} actions={this.props.actions} onChange={this.handleOnChange} />
                                ))}
                            </div>
                            <div>
                                {(tablesToShow || 15) < (tables || []).length && (
                                    <Button
                                        style={{
                                            marginRight: '10px',
                                            borderRadius: '5px',
                                            border: '1px solid #d9d9d9',
                                        }}
                                        onClick={this.loadMoreTables}>Load More</Button>
                                )}
                                <Button onClick={this.openRefreshModal}>Clear Selection and Refresh</Button>
                            </div>

                        </Collapse.Panel>
                    </Collapse>
                    <Modal
                        title="Clear Selection and Refresh"
                        visible={this.state.confirmRefreshModalVisible}
                        onOk={this.handleRefresh}
                        onCancel={this.closeRefreshModal}
                        centered >
                        <p>Are you sure you want to clear the selection and refresh the tables?</p>
                        </Modal>
                </div>
            </>
        );
    }
}