import {createRange} from './ultimate-pagination-utils';
import {
  createPageFunctionFactory,
  createFirstEllipsis,
  createSecondEllipsis,
  createFirstPageLink,
  createPreviousPageLink,
  createNextPageLink,
  createLastPageLink,
  PaginationModelItem
} from './ultimate-pagination-item-factories';

export interface PaginationModelOptions {
  currentPage: number;
  totalPages: number;
  boundaryPagesRange?: number;
  siblingPagesRange?: number;
  hideEllipsis?: boolean;
  hidePreviousAndNextPageLinks?: boolean;
  hideFirstAndLastPageLinks?: boolean;
}

export {PaginationModelItem};

export type PaginationModel = PaginationModelItem[];

export function getPaginationModel(options: PaginationModelOptions): PaginationModel {
  if (options == null) { throw new Error('getPaginationModel(): options object should be a passed'); }

  const totalPages = Number(options.totalPages);
  if (isNaN(totalPages)) { throw new Error('getPaginationModel(): totalPages should be a number'); }
  if (totalPages < 0) { throw new Error('getPaginationModel(): totalPages shouldn\'t be a negative number'); }

  const currentPage = Number(options.currentPage);
  if (isNaN(currentPage)) { throw new Error('getPaginationModel(): currentPage should be a number'); }
  if (currentPage < 0) { throw new Error('getPaginationModel(): currentPage shouldn\'t be a negative number'); }
  if (currentPage > totalPages) { throw new Error('getPaginationModel(): currentPage shouldn\'t be greater than totalPages'); }

  const boundaryPagesRange = (options.boundaryPagesRange == null ? 1 : Number(options.boundaryPagesRange));
  if (isNaN(boundaryPagesRange)) { throw new Error('getPaginationModel(): boundaryPagesRange should be a number'); }
  if (boundaryPagesRange < 0) { throw new Error('getPaginationModel(): boundaryPagesRange shouldn\'t be a negative number'); }

  const siblingPagesRange = (options.siblingPagesRange == null ? 1 : Number(options.siblingPagesRange));
  if (isNaN(siblingPagesRange)) { throw new Error('getPaginationModel(): siblingPagesRange should be a number'); }
  if (siblingPagesRange < 0) { throw new Error('getPaginationModel(): siblingPagesRange shouldn\'t be a negative number'); }

  const hidePreviousAndNextPageLinks = Boolean(options.hidePreviousAndNextPageLinks);
  const hideFirstAndLastPageLinks = Boolean(options.hideFirstAndLastPageLinks);
  const hideEllipsis = Boolean(options.hideEllipsis);

  const ellipsisSize = (hideEllipsis ? 0 : 1);
  const paginationModel: PaginationModelItem[] = [];
  const createPage = createPageFunctionFactory(options);

  if (!hideFirstAndLastPageLinks) {
    paginationModel.push(createFirstPageLink(options));
  }

  if (!hidePreviousAndNextPageLinks) {
    paginationModel.push(createPreviousPageLink(options));
  }

  // Simplify generation of pages if number of available items is equal or greater than total pages to show
  if (1 + 2 * ellipsisSize + 2 * siblingPagesRange + 2 * boundaryPagesRange >= totalPages) {
    const allPages = createRange(1,  totalPages).map(createPage);
    paginationModel.push(...allPages);
  } else {
    // Calculate group of first pages
    const firstPagesStart = 1;
    const firstPagesEnd = boundaryPagesRange;
    const firstPages = createRange(firstPagesStart,  firstPagesEnd).map(createPage);

    // Calculate group of last pages
    const lastPagesStart = totalPages + 1 - boundaryPagesRange;
    const lastPagesEnd = totalPages;
    const lastPages = createRange(lastPagesStart, lastPagesEnd).map(createPage);

    // Calculate group of main pages
    const mainPagesStart = Math.min(
      Math.max(
        currentPage - siblingPagesRange,
        firstPagesEnd + ellipsisSize + 1
      ),
      lastPagesStart - ellipsisSize - 2 * siblingPagesRange - 1
    );
    const mainPagesEnd = mainPagesStart + 2 * siblingPagesRange;
    const mainPages = createRange(mainPagesStart,  mainPagesEnd).map(createPage);

    // Add group of first pages
    paginationModel.push(...firstPages);

    if (!hideEllipsis) {
      // Calculate and add ellipsis before group of main pages
      const firstEllipsisPageNumber = mainPagesStart - 1;
      const showPageInsteadOfFirstEllipsis = (firstEllipsisPageNumber === firstPagesEnd + 1);
      const createFirstEllipsisOrPage = showPageInsteadOfFirstEllipsis ? createPage : createFirstEllipsis;
      const firstEllipsis = createFirstEllipsisOrPage(firstEllipsisPageNumber);
      paginationModel.push(firstEllipsis);
    }

    // Add group of main pages
    paginationModel.push(...mainPages);

    if (!hideEllipsis) {
      // Calculate and add ellipsis after group of main pages
      const secondEllipsisPageNumber = mainPagesEnd + 1;
      const showPageInsteadOfSecondEllipsis = (secondEllipsisPageNumber === lastPagesStart - 1);
      const createSecondEllipsisOrPage = showPageInsteadOfSecondEllipsis ? createPage : createSecondEllipsis;
      const secondEllipsis = createSecondEllipsisOrPage(secondEllipsisPageNumber);
      paginationModel.push(secondEllipsis);
    }

    // Add group of last pages
    paginationModel.push(...lastPages);
  }

  if (!hidePreviousAndNextPageLinks) {
    paginationModel.push(createNextPageLink(options));
  }

  if (!hideFirstAndLastPageLinks) {
    paginationModel.push(createLastPageLink(options));
  }

  return paginationModel;
}

export {ITEM_TYPES, ITEM_KEYS, PaginationItemType} from './ultimate-pagination-constants';
