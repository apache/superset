import * as React from 'react';
import { SelectCallback } from 'react-bootstrap';

declare namespace PanelCollapse {
    export interface PanelCollapseProps extends React.HTMLProps<PanelCollapse> {
        bsClass?: string;
        onEnter?: Function;
        onEntering?: Function;
        onEntered?: Function;
        onExit?: Function;
        onExiting?: Function;
        onExited?: Function;
    }
}
declare class PanelCollapse extends React.Component<PanelCollapse.PanelCollapseProps> { }
export = PanelCollapse;
