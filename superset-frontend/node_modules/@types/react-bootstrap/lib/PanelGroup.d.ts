import * as React from 'react';
import { Sizes, SelectCallback } from 'react-bootstrap';

declare namespace PanelGroup {
    export interface PanelGroupProps extends React.HTMLProps<PanelGroup> {
        accordion?: boolean;
        activeKey?: any;
        defaultActiveKey?: any;
        onSelect?: SelectCallback;
        role?: string;
        generateChildId?: Function;
    }
}
declare class PanelGroup extends React.Component<PanelGroup.PanelGroupProps> { }
export = PanelGroup;
