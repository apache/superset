import * as React from 'react';
import { Sizes, Omit } from 'react-bootstrap';

declare namespace Popover {
    export interface PopoverProps extends Omit<React.HTMLProps<Popover>, "title"> {
        // Optional
        arrowOffsetLeft?: number | string;
        arrowOffsetTop?: number | string;
        bsSize?: Sizes;
        bsStyle?: string;
        bsClass?: string;
        placement?: string;
        positionLeft?: number | string; // String support added since v0.30.0
        positionTop?: number | string; // String support added since v0.30.0
        title?: React.ReactNode;
    }
}
declare class Popover extends React.Component<Popover.PopoverProps> { }
export = Popover;
