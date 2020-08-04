import * as React from 'react';
import { Sizes } from 'react-bootstrap';

declare namespace ButtonToolbar {
    export interface ButtonToolbarProps extends React.HTMLProps<ButtonToolbar> {
        block?: boolean;
        bsSize?: Sizes;
        bsStyle?: string;
        bsClass?: string;
        justified?: boolean;
        vertical?: boolean;
    }
}
declare class ButtonToolbar extends React.Component<ButtonToolbar.ButtonToolbarProps> { }
export = ButtonToolbar;
