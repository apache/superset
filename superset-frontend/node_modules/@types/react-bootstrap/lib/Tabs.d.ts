import * as React from 'react';
import { SelectCallback } from 'react-bootstrap';

declare namespace Tabs {
    export interface TabsProps extends React.HTMLProps<Tabs> {
        activeKey?: any;
        animation?: boolean;
        bsStyle?: string;
        defaultActiveKey?: any;
        onSelect?: SelectCallback;
        paneWidth?: any; // TODO: Add more specific type
        position?: string;
        tabWidth?: any; // TODO: Add more specific type
        mountOnEnter?: boolean;
        unmountOnExit?: boolean;
        justified?: boolean;
    }
}
declare class Tabs extends React.Component<Tabs.TabsProps> { }
export = Tabs;
