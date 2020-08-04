import * as React from 'react';

declare namespace ControlLabel {
    export interface ControlLabelProps extends React.HTMLProps<ControlLabel> {
        bsClass?: string;
        htmlFor?: string;
        srOnly?: boolean;
    }
}
declare class ControlLabel extends React.Component<ControlLabel.ControlLabelProps> { }
export = ControlLabel;
