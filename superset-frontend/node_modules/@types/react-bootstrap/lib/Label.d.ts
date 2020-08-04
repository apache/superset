import * as React from 'react';
import { Sizes } from 'react-bootstrap';

declare namespace Label {
    export interface LabelProps extends React.HTMLProps<Label> {
        bsSize?: Sizes;
        bsStyle?: string;
    }
}
declare class Label extends React.Component<Label.LabelProps> { }
export = Label;
