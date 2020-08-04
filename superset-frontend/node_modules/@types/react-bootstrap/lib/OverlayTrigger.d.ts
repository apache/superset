import * as React from 'react';

declare namespace OverlayTrigger {
    export interface OverlayTriggerProps extends React.Props<OverlayTrigger> {
        // Required
        overlay: any; // TODO: Add more specific type

        // Optional
        animation?: any; // TODO: Add more specific type
        container?: any; // TODO: Add more specific type
        containerPadding?: number;
        defaultOverlayShown?: boolean;
        delay?: number;
        delayHide?: number;
        delayShow?: number;
        onEnter?: Function;
        onEntered?: Function;
        onEntering?: Function;
        onExit?: Function;
        onExited?: Function;
        onExiting?: Function;
        placement?: string;
        rootClose?: boolean;
        trigger?: string | string[];
    }
}
declare class OverlayTrigger extends React.Component<OverlayTrigger.OverlayTriggerProps> { }
export = OverlayTrigger;
