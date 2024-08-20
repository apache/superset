import { Collapse } from "antd";
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
        };
    }

    handleSelect = () => {
        this.setState((prevState: DatasourceProps) => ({
            selected: !prevState.selected,
        }));
    };

    async componentDidMount() {
        const { id } = this.props;
        const schema = await fetchSchemaData(id);
        const schemaData:DatasourceSchemaProps[]  = schema.map((schema: DatabaseScemaData) => {
            return {
                databaseId: id,
                selected: false,
                schemaName: schema.schema_name,
                description: schema.description,
            };
        });
        this.setState((prevState: DatasourceProps) => ({
            schema: schemaData,
        }));
    }
    

    render() {
        const { selected, schema } = this.state;
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
                            <input
                                type="checkbox"
                                checked={selected}
                                onChange={this.handleSelect}
                            />
                            {/* tab */}
                            <span
                                style={{
                                    width: "10px",
                                }}></span>
                            <span>{datasourceName}</span>
                        </div>
                    } key="-1" >
                    <div style={{
                        display: "flex",
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: "10px",
                    }} >
                        {schema.map((schema) => (
                            <DatasourceSchema key={'d_schema'+schema.schemaName} {...schema} />
                        ))}
                    </div>
                </Collapse.Panel>
            </Collapse>
        );
    }
}