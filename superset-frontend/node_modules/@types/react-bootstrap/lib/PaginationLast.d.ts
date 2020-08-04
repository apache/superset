import * as React from 'react';
import { SelectCallback } from 'react-bootstrap';

declare namespace PaginationLast {
    export interface PaginationLastProps extends React.HTMLProps<PaginationLast> {
        disabled?: boolean;
    }
}
declare class PaginationLast extends React.Component<PaginationLast.PaginationLastProps> { }
export = PaginationLast;
