import * as React from 'react';

declare namespace Table {
    export interface TableProps extends React.HTMLProps<Table> {
        bordered?: boolean;
        condensed?: boolean;
        hover?: boolean;
        responsive?: boolean;
        striped?: boolean;
        fill?: boolean;
        bsClass?: string;
    }
}
declare class Table extends React.Component<Table.TableProps> { }
export = Table;
