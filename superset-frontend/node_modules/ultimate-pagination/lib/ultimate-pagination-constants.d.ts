export declare type PageItemType = 'PAGE';
export declare type EllipsisItemType = 'ELLIPSIS';
export declare type FirstPageLinkItemType = 'FIRST_PAGE_LINK';
export declare type PreviousPageLinkItemType = 'PREVIOUS_PAGE_LINK';
export declare type NextPageLinkItemType = 'NEXT_PAGE_LINK';
export declare type LastPageLinkItemType = 'LAST_PAGE_LINK';
export declare type PaginationItemType = PageItemType | EllipsisItemType | FirstPageLinkItemType | PreviousPageLinkItemType | NextPageLinkItemType | LastPageLinkItemType;
export interface ItemTypes {
    PAGE: PageItemType;
    ELLIPSIS: EllipsisItemType;
    FIRST_PAGE_LINK: FirstPageLinkItemType;
    PREVIOUS_PAGE_LINK: PreviousPageLinkItemType;
    NEXT_PAGE_LINK: NextPageLinkItemType;
    LAST_PAGE_LINK: LastPageLinkItemType;
}
export interface ItemKeys {
    FIRST_ELLIPSIS: number;
    SECOND_ELLIPSIS: number;
    FIRST_PAGE_LINK: number;
    PREVIOUS_PAGE_LINK: number;
    NEXT_PAGE_LINK: number;
    LAST_PAGE_LINK: number;
    [type: string]: number;
}
export declare const ITEM_TYPES: ItemTypes;
export declare const ITEM_KEYS: ItemKeys;
