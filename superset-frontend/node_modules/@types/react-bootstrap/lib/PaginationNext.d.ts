import * as React from 'react';
import { SelectCallback } from 'react-bootstrap';

declare namespace PaginationNext {
    export interface PaginationNextProps extends React.HTMLProps<PaginationNext> {
        disabled?: boolean;
    }
}
declare class PaginationNext extends React.Component<PaginationNext.PaginationNextProps> { }
export = PaginationNext;
