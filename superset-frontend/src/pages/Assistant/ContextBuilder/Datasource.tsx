import { Collapse, Spin } from "antd";
import { DatasourceSchemaProps, DatasourceSchema } from "./DatasourceSchema";
import React from "react";
import { fetchSchemaData, DatabaseScemaData } from "../contextUtils";

/**
 * Props
 */
export interface DatasourceProps {
    selected?: boolean;
    id: number;
    datasourceName: string;
    schema: DatasourceSchemaProps[];
    onChange?: (data: DatasourceProps) => void;
    loading?: boolean;
}

/**
 * Datasource Component
 */
export class Datasource extends React.Component<DatasourceProps> {
    state: DatasourceProps;
    //constructor
    constructor(props: DatasourceProps) {
        super(props);
        this.state = {
            ...this.props,
            selected: this.props.selected || false,
            loading: true,
        };
    }

    handleSelect = () => {
        this.setState((prevState: DatasourceProps) => ({
            selected: !prevState.selected,
        }));
    };

    async componentDidMount() {
        const { id , datasourceName} = this.props;
        const schema = await fetchSchemaData(id);
        const schemaData:DatasourceSchemaProps[]  = schema.map((schema: DatabaseScemaData) => {
            return {
                datasourceName: datasourceName,
                databaseId: id,
                selected: false,
                schemaName: schema.schema_name,
                description: schema.description,
            };
        });
        this.setState((prevState: DatasourceProps) => ({
            schema: schemaData,
            loading: false,
        }));
    }

    handleOnChange = (data: DatasourceSchemaProps) => {
        this.setState((prevState: DatasourceProps) => {
            const newSchema = prevState.schema.map((schema) => {
                return schema.schemaName === data.schemaName ? data : schema;
            });
            return {
                ...prevState,
                schema: newSchema,
            };
        }, () => {
            // filter out where [].schema.tables.selectedColumns.length > 0
            const filteredState = {
                ...this.state,
                schema: this.state.schema.filter((schema) => {
                    return (schema.tables || []).filter((table) => {
                        return (table.selectedColumns || []).length > 0;
                    }).length > 0;
                }),
            };
            this.state.onChange?.call(this, filteredState);
        });
    };
    

    render() {
        const { schema, loading } = this.state;
        const { datasourceName } = this.props;
        return (
            <Collapse style={{
                padding: '0px',
            }}>
                <Collapse.Panel style={{
                    padding: '0px',
                }} header={
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "row",
                            }}>
                            <span>{datasourceName} </span>
                            <span style={{ width: '10px' }}></span>
                            {loading && <Spin size="small" />}
                        </div>
                    } key="-1" >
                    <div style={{
                        display: "flex",
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: "10px",
                    }} >
                        {schema.map((schema) => (
                            <DatasourceSchema key={'d_schema'+schema.schemaName} {...schema} onChange={this.handleOnChange} />
                        ))}
                    </div>
                </Collapse.Panel>
            </Collapse>
        );
    }
}