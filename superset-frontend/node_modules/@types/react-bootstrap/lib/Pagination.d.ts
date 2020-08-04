import * as React from 'react';
import { Sizes, SelectCallback } from 'react-bootstrap';
import PaginationFirst = require('./PaginationFirst');
import PaginationPrev = require('./PaginationPrev');
import PaginationNext = require('./PaginationNext');
import PaginationLast = require('./PaginationLast');
import PaginationEllipsis = require('./PaginationEllipsis');
import PaginationItem = require('./PaginationItem');

declare namespace Pagination {
    export interface PaginationProps extends React.HTMLProps<Pagination> {
        bsSize?: Sizes;
    }
}
declare class Pagination extends React.Component<Pagination.PaginationProps> {
    static First: typeof PaginationFirst;
    static Prev: typeof PaginationPrev;
    static Next: typeof PaginationNext;
    static Last: typeof PaginationLast;
    static Ellipsis: typeof PaginationEllipsis;
    static Item: typeof PaginationItem;
}
export = Pagination;
