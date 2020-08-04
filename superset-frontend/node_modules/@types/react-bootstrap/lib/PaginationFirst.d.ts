import * as React from 'react';
import { SelectCallback } from 'react-bootstrap';

declare namespace PaginationFirst {
    export interface PaginationFirstProps extends React.HTMLProps<PaginationFirst> {
        disabled?: boolean;
    }
}
declare class PaginationFirst extends React.Component<PaginationFirst.PaginationFirstProps> { }
export = PaginationFirst;
