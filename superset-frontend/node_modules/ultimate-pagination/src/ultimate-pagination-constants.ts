export type PageItemType = 'PAGE';
export type EllipsisItemType = 'ELLIPSIS';
export type FirstPageLinkItemType = 'FIRST_PAGE_LINK';
export type PreviousPageLinkItemType = 'PREVIOUS_PAGE_LINK';
export type NextPageLinkItemType = 'NEXT_PAGE_LINK';
export type LastPageLinkItemType = 'LAST_PAGE_LINK';

export type PaginationItemType =
  PageItemType |
  EllipsisItemType |
  FirstPageLinkItemType |
  PreviousPageLinkItemType |
  NextPageLinkItemType |
  LastPageLinkItemType;

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

export const ITEM_TYPES: ItemTypes = {
  PAGE: 'PAGE',
  ELLIPSIS: 'ELLIPSIS',
  FIRST_PAGE_LINK: 'FIRST_PAGE_LINK',
  PREVIOUS_PAGE_LINK: 'PREVIOUS_PAGE_LINK',
  NEXT_PAGE_LINK: 'NEXT_PAGE_LINK',
  LAST_PAGE_LINK: 'LAST_PAGE_LINK'
};

export const ITEM_KEYS: ItemKeys = {
  FIRST_ELLIPSIS: -1,
  SECOND_ELLIPSIS: -2,
  FIRST_PAGE_LINK: -3,
  PREVIOUS_PAGE_LINK: -4,
  NEXT_PAGE_LINK: -5,
  LAST_PAGE_LINK: -6
};

