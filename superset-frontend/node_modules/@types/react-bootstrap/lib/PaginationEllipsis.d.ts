import * as React from 'react';
import { SelectCallback } from 'react-bootstrap';

declare namespace PaginationEllipsis {
    export interface PaginationEllipsisProps extends React.HTMLProps<PaginationEllipsis> {
        disabled?: boolean;
    }
}
declare class PaginationEllipsis extends React.Component<PaginationEllipsis.PaginationEllipsisProps> { }
export = PaginationEllipsis;
