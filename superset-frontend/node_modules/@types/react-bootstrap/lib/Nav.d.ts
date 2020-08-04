import * as React from 'react';
import { Sizes } from 'react-bootstrap';

declare namespace Nav {
    export interface NavProps extends React.HTMLProps<Nav> {
        // Optional
        activeHref?: string;
        activeKey?: any;
        bsSize?: Sizes;
        bsStyle?: string;
        bsClass?: string;
        collapsible?: boolean;
        eventKey?: any;
        expanded?: boolean;
        justified?: boolean;
        navbar?: boolean;
        pullRight?: boolean;
        right?: boolean;
        stacked?: boolean;
        ulClassName?: string;
        ulId?: string;
    }
}
declare class Nav extends React.Component<Nav.NavProps> { }
export = Nav;
