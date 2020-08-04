import * as React from 'react';
import { TransitionCallbacks } from 'react-bootstrap';

declare namespace Collapse {
    export interface CollapseProps extends TransitionCallbacks, React.ClassAttributes<Collapse> {
        dimension?: 'height' | 'width' | { ( ):string };
        getDimensionValue?: ( dimension:number, element:React.ReactElement ) => number;
        in?: boolean;
        timeout?: number;
        transitionAppear?: boolean;
        unmountOnExit?: boolean;
    }
}
declare class Collapse extends React.Component<Collapse.CollapseProps> { }
export = Collapse;
