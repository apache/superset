import {ITEM_TYPES, ITEM_KEYS, PaginationItemType} from './ultimate-pagination-constants';
import {PaginationModelOptions} from './ultimate-pagination';

export interface PaginationModelItem {
    key: number;
    value: number;
    isActive: boolean;
    type: PaginationItemType;
}

export const createFirstEllipsis = (pageNumber: number): PaginationModelItem => {
  return {
    type: ITEM_TYPES.ELLIPSIS,
    key: ITEM_KEYS.FIRST_ELLIPSIS,
    value: pageNumber,
    isActive: false
  };
};

export const createSecondEllipsis = (pageNumber: number): PaginationModelItem => {
  return {
    type: ITEM_TYPES.ELLIPSIS,
    key: ITEM_KEYS.SECOND_ELLIPSIS,
    value: pageNumber,
    isActive: false
  };
};

export const createFirstPageLink = (options: PaginationModelOptions): PaginationModelItem => {
  let {currentPage} = options;

  return {
    type: ITEM_TYPES.FIRST_PAGE_LINK,
    key: ITEM_KEYS.FIRST_PAGE_LINK,
    value: 1,
    isActive: currentPage === 1
  };
};

export const createPreviousPageLink = (options: PaginationModelOptions): PaginationModelItem => {
  let {currentPage} = options;

  return {
    type: ITEM_TYPES.PREVIOUS_PAGE_LINK,
    key: ITEM_KEYS.PREVIOUS_PAGE_LINK,
    value: Math.max(1, currentPage - 1),
    isActive: currentPage === 1
   };
};

export const createNextPageLink = (options: PaginationModelOptions): PaginationModelItem => {
  let {currentPage, totalPages} = options;

  return {
    type: ITEM_TYPES.NEXT_PAGE_LINK,
    key: ITEM_KEYS.NEXT_PAGE_LINK,
    value: Math.min(totalPages, currentPage + 1),
    isActive: currentPage === totalPages
  };
};

export const createLastPageLink = (options: PaginationModelOptions): PaginationModelItem => {
  let {currentPage, totalPages} = options;

  return {
    type: ITEM_TYPES.LAST_PAGE_LINK,
    key: ITEM_KEYS.LAST_PAGE_LINK,
    value: totalPages,
    isActive: currentPage === totalPages
   };
};

export const createPageFunctionFactory = (options: PaginationModelOptions) => {
  let {currentPage} = options;

  return (pageNumber: number): PaginationModelItem => {
    return {
      type: ITEM_TYPES.PAGE,
      key: pageNumber,
      value: pageNumber,
      isActive: pageNumber === currentPage
    };
  };
};
