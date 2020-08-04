import * as React from 'react';
import { TransitionCallbacks } from 'react-bootstrap';

declare namespace Overlay {
    export interface OverlayProps extends TransitionCallbacks {
        // Optional
        animation?: any; // TODO: Add more specific type
        container?: any; // TODO: Add more specific type
        containerPadding?: number; // TODO: Add more specific type
        onHide?: Function;
        placement?: string;
        rootClose?: boolean;
        show?: boolean;
        target?: Function | React.ReactInstance;
        shouldUpdatePosition?: boolean;
    }
}
declare class Overlay extends React.Component<Overlay.OverlayProps> { }
export = Overlay;
