import * as React from 'react';

declare namespace Grid {
    export interface GridProps extends React.HTMLProps<Grid> {
        componentClass?: React.ReactType;
        fluid?: boolean;
        bsClass?: string;
    }
}
declare class Grid extends React.Component<Grid.GridProps> { }
export = Grid;
