import * as React from 'react';
import { TransitionCallbacks } from 'react-bootstrap';

declare namespace Fade {
    export interface FadeProps extends TransitionCallbacks, React.HTMLProps<Fade> {
        in?: boolean;
        timeout?: number;
        mountOnEnter?: boolean;
        appear?: boolean;
        unmountOnExit?: boolean;
    }
}
declare class Fade extends React.Component<Fade.FadeProps> { }
export = Fade;
