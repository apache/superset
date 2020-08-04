import * as React from 'react';
import { SelectCallback } from 'react-bootstrap';

declare namespace PanelHeading {
    export interface PanelHeadingProps extends React.HTMLProps<PanelHeading> {
        componentClass?: string;
        bsClass?: string;
    }
}
declare class PanelHeading extends React.Component<PanelHeading.PanelHeadingProps> { }
export = PanelHeading;
