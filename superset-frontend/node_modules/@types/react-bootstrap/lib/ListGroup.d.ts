import * as React from 'react';

declare namespace ListGroup {
    interface ListGroupProps extends React.HTMLProps<ListGroup> {
        bsClass?: string;
        componentClass?: React.ReactType; // Added since v0.30.0
        // TODO: Add more specific type
        fill?: boolean;
    }
}
declare class ListGroup extends React.Component<ListGroup.ListGroupProps> { }
export = ListGroup;
