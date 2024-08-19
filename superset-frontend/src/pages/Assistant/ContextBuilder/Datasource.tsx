import { Collapse } from "antd";
import { DatasourceSchemaProps, DatasourceSchema } from "./DatasourceSchema";
/**
 * Props
 */

export interface DatasourceProps {
    selected?: boolean;
    datasourceName: string;
    schema: DatasourceSchemaProps[];
}

/**
 * Datasource Component
 */

export function Datasource(props: DatasourceProps) {
    return (
        <Collapse> 
            <Collapse.Panel header={
                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                }}>
                    <input type="checkbox" checked={props.selected || false} />
                    {/* tab */}
                    <span style={{
                        width: '10px',
                    }} ></span>
                    <span>{props.datasourceName}</span>
                </div>
            } key="-1">
                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: '10px',
                }}>
                    {props.schema.map((schema, index) => (
                        <DatasourceSchema key={index} {...schema} />
                    ))}
                </div>

            </Collapse.Panel>
        </Collapse>
    )
}