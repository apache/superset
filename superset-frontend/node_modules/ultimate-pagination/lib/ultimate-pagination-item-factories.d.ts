import { PaginationItemType } from './ultimate-pagination-constants';
import { PaginationModelOptions } from './ultimate-pagination';
export interface PaginationModelItem {
    key: number;
    value: number;
    isActive: boolean;
    type: PaginationItemType;
}
export declare const createFirstEllipsis: (pageNumber: number) => PaginationModelItem;
export declare const createSecondEllipsis: (pageNumber: number) => PaginationModelItem;
export declare const createFirstPageLink: (options: PaginationModelOptions) => PaginationModelItem;
export declare const createPreviousPageLink: (options: PaginationModelOptions) => PaginationModelItem;
export declare const createNextPageLink: (options: PaginationModelOptions) => PaginationModelItem;
export declare const createLastPageLink: (options: PaginationModelOptions) => PaginationModelItem;
export declare const createPageFunctionFactory: (options: PaginationModelOptions) => (pageNumber: number) => PaginationModelItem;
