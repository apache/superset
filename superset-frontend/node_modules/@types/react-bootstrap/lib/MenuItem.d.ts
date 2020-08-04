import * as React from 'react';
import { SelectCallback } from 'react-bootstrap';

declare namespace MenuItem {
    export interface MenuItemProps extends React.HTMLProps<MenuItem> {
        active?: boolean;
        bsClass?: string;
        disabled?: boolean;
        divider?: boolean;
        eventKey?: any;
        header?: boolean;
        onClick?: React.MouseEventHandler<{}>;
        onSelect?: SelectCallback;
        target?: string;
        title?: string;
    }
}
declare class MenuItem extends React.Component<MenuItem.MenuItemProps> { }
export = MenuItem;
