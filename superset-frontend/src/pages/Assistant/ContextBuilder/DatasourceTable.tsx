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
export function DatasourceTable(props: DatasourceTableProps) {
    const columns = [{
        title: 'Column',
        dataIndex: 'columnName',
        key: 'columnName',
    }, {
        title: 'Type',
        dataIndex: 'columnType',
        key: 'columnType',
    }];

    return (
        <div style={{
            width: 'fit-content',
            maxWidth: '300px',
        }} >
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
                        <span>{props.tableName}</span>
                    </div>
                } key="-1">
                    <Table  columns={columns} dataSource={props.columns} rowSelection={{ }} />
                </Collapse.Panel>
            </Collapse>



        </div>
    );

}