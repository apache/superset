import { PaginationModelItem } from './ultimate-pagination-item-factories';
export interface PaginationModelOptions {
    currentPage: number;
    totalPages: number;
    boundaryPagesRange?: number;
    siblingPagesRange?: number;
    hideEllipsis?: boolean;
    hidePreviousAndNextPageLinks?: boolean;
    hideFirstAndLastPageLinks?: boolean;
}
export { PaginationModelItem };
export declare type PaginationModel = PaginationModelItem[];
export declare function getPaginationModel(options: PaginationModelOptions): PaginationModel;
export { ITEM_TYPES, ITEM_KEYS, PaginationItemType } from './ultimate-pagination-constants';
