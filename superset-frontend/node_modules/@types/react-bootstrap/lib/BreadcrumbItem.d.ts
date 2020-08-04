import * as React from 'react';

declare namespace BreadcrumbItem {
    export interface BreadcrumbItemProps extends React.Props<BreadcrumbItem> {
        active?: boolean;
        href?: string;
        title?: React.ReactNode;
        target?: string;
    }
}
declare class BreadcrumbItem extends React.Component<BreadcrumbItem.BreadcrumbItemProps> { }
export = BreadcrumbItem;
