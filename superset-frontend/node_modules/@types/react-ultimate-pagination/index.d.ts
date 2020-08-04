// Type definitions for react-ultimate-pagination 1.2
// Project: https://github.com/ultimate-pagination/react-ultimate-pagination
// Definitions by: Ben Lorantfy <https://github.com/BenLorantfy>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.8
import * as React from "react";

export interface PaginationComponentProps {
    /**
     * Number of pages that user should navigate to when item is activated (for items with type `PAGE` it also can be used as a label in UI)
     */
    value: number;

    /**
     * Show if `currentPage` if the same as `value` of an item (can be used to highlight a current page or disable first, previous, next or last page links when user is already on first/last page)
     */
    isActive: boolean;

    /**
     * Show if button should be disabled
     */
    isDisabled: boolean;

    /**
     * Should be called when user interacted with a component and the current page should be changed to the page represented by item (no arguments should be used, can be used for all item types)
     */
    onClick: () => void;
}

export enum ITEM_TYPES {
    PAGE = "PAGE",
    ELLIPSIS = "ELLIPSIS",
    FIRST_PAGE_LINK = "FIRST_PAGE_LINK",
    PREVIOUS_PAGE_LINK = "PREVIOUS_PAGE_LINK",
    NEXT_PAGE_LINK = "NEXT_PAGE_LINK",
    LAST_PAGE_LINK = "LAST_PAGE_LINK",
}

export interface ItemTypeToComponent {
    /**
     * A link to a page
     */
    PAGE: React.ComponentType<PaginationComponentProps>;

    /**
     * An item that represents groups of pages that currently are not visible in paginator (can be used to navigate to the page in the group that is the nearest to the current page)
     */
    ELLIPSIS: React.ComponentType<PaginationComponentProps>;

    /**
     * A link to the first page
     */
    FIRST_PAGE_LINK: React.ComponentType<PaginationComponentProps>;

    /**
     * A link to the previous page
     */
    PREVIOUS_PAGE_LINK: React.ComponentType<PaginationComponentProps>;

    /**
     * A link to the next page
     */
    NEXT_PAGE_LINK: React.ComponentType<PaginationComponentProps>;

    /**
     * A link to the last page
     */
    LAST_PAGE_LINK: React.ComponentType<PaginationComponentProps>;
}

export interface CreateUltimatePaginationOptions {
    /**
     * An object that is used as a map from the item type to the React.js component that will be used to render this item
     */
    itemTypeToComponent: ItemTypeToComponent;

    /**
     * A React.js component that will be used as a wrapper for pagination items
     */
    WrapperComponent?: string|React.ComponentType<any>;
}

export interface UltimatePaginationProps {
    /**
     * Current page number
     */
    currentPage: number;

    /**
     * Total number of pages
     */
    totalPages: number;

    /**
     * Number of always visible pages at the beginning and end
     */
    boundaryPagesRange?: number;

    /**
     * Number of always visible pages before and after the current one
     */
    siblingPagesRange?: number;

    /**
     * Boolean flag to hide ellipsis
     */
    hideEllipsis?: boolean;

    /**
     * Boolean flag to hide previous and next page links
     */
    hidePreviousAndNextPageLinks?: boolean;

    /**
     * Boolean flag to hide first and last page links
     */
    hideFirstAndLastPageLinks?: boolean;

    /**
     * Callback that will be called with new page when it should be changed by user interaction
     */
    onChange?: (newPage: number) => void;

    /**
     * Boolean flag to disable all buttons in pagination
     */
    disabled?: boolean;
}

export function createUltimatePagination(options: CreateUltimatePaginationOptions): React.ComponentType<UltimatePaginationProps>;
