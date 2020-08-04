import * as React from 'react';
import { Sizes } from 'react-bootstrap';

declare namespace ListGroupItem {
    export interface ListGroupItemProps extends React.HTMLProps<ListGroupItem> {
        active?: any;
        bsSize?: Sizes;
        bsStyle?: string;
        eventKey?: any;
        header?: React.ReactNode;
        listItem?: boolean;
    }
}
declare class ListGroupItem extends React.Component<ListGroupItem.ListGroupItemProps> { }
export = ListGroupItem;
