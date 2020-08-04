import * as React from 'react';
import { Sizes, Omit } from 'react-bootstrap';

declare namespace ProgressBar {
    export interface ProgressBarProps extends Omit<React.HTMLProps<ProgressBar>, "label"> {
        // Optional
        active?: boolean;
        bsSize?: Sizes;
        bsStyle?: string;
        bsClass?: string;
        interpolatedClass?: any; // TODO: Add more specific type
        max?: number;
        min?: number;
        now?: number;
        srOnly?: boolean;
        striped?: boolean;
        label?: React.ReactNode;
    }
}
declare class ProgressBar extends React.Component<ProgressBar.ProgressBarProps> { }
export = ProgressBar;
