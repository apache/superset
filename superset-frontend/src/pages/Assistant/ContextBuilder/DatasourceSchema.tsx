import { Collapse, Spin, Input } from "antd";
import { DatasourceTableProps } from "./DatasourceTable";
import { DatasourceTable } from "./DatasourceTable";
import React, { Component } from "react";
import { fetchTableData, DatabaseSchemaTableData } from "../contextUtils";

/**
 * Props
 */
export interface DatasourceSchemaProps {
    databaseId: number;
    datasourceName: string;
    selected?: boolean;
    schemaName: string;
    description?: string;
    tables?: DatasourceTableProps[];
    onChange?: (data: DatasourceSchemaProps) => void;
    loading?: boolean;
    descriptionFocused?: boolean;
    isDescriptionLoading?: boolean;
}

/**
 * DatasourceSchema Component
 */
export class DatasourceSchema extends Component<DatasourceSchemaProps> {

    state: DatasourceSchemaProps = {
        selected: this.props.selected || false,
        tables: this.props.tables || [],
        loading: true,
        descriptionFocused: false,
        isDescriptionLoading: false,
        ...this.props
    };

    handleSelect = () => {
        this.setState((prevState: DatasourceSchemaProps) => ({
            selected: !prevState.selected
        }));
    };

    async componentDidMount() {
        const { databaseId, schemaName, datasourceName } = this.props;
        const tables = await fetchTableData(databaseId, schemaName);
        const tableData: DatasourceTableProps[] = tables.map((table: DatabaseSchemaTableData) => {
            return {
                databaseId: databaseId,
                datasourceName:datasourceName,
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
        const { loading, schemaName, tables, description, descriptionFocused, isDescriptionLoading } = this.state;
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
                                            {description? '✅' : '?'}
                                        </span>
                                        {loading && <Spin size="small" />}
                                    </div>
                                    <div>
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
                                    </div>
                                </div>

                            } key={schemaName}>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'row',
                                flexWrap: 'wrap',
                                gap: 'px',
                            }}>
                                {tables?.map((table) => (
                                    <DatasourceTable key={'tables' + table.tableName} {...table} onChange={this.handleOnChange} />
                                ))}
                            </div>
                        </Collapse.Panel>
                    </Collapse>
                </div>
            </>
        );
    }
}