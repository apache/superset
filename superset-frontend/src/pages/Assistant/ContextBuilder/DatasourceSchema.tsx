import { Collapse } from "antd";
import { DatasourceTableProps } from "./DatasourceTable";
import { DatasourceTable } from "./DatasourceTable";

/**
 * Props
 */
export interface DatasourceSchemaProps {
    selected?: boolean;
    schemaName: string;
    description?: string;
    tables: DatasourceTableProps[];
}

/**
 * DatasourceSchema Component
 */
export function DatasourceSchema(props: DatasourceSchemaProps) {
    
    return (
        <>
            <div style={{
                width: '100%',
                // borderTopRightRadius: '16px',
                // borderBottomRightRadius: '16px',
                // padding: '24px',
                background: '#f0f0f0',
            }}>
                <Collapse>
                <Collapse.Panel header={
                    <div style={{
                        display: 'flex',
                        flexDirection: 'row',
                    }}>
                        <input type="checkbox" checked={props.selected || false}  />
                        {/* tab */}
                        <span style={{
                            width: '10px',
                        }} ></span>
                        <span>{props.schemaName}</span>
                    </div>
                } key="-1">
                    <div style={{
                        display: 'flex',
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: '10px',
                    }}>
                    {props.tables.map((table, index) => (
                        <DatasourceTable key={index} {...table} />
                    ))}
                    </div>
                    
                </Collapse.Panel>
                </Collapse>
            </div>
        </>
    )
}