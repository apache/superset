import * as React from 'react';

declare namespace Row {
    export interface RowProps extends React.HTMLProps<Row> {
        componentClass?: React.ReactType;
    }
}
declare class Row extends React.Component<Row.RowProps> { }
export = Row;
