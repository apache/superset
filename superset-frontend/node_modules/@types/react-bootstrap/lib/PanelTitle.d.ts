import * as React from 'react';
import { SelectCallback } from 'react-bootstrap';

declare namespace PanelTitle {
    export interface PanelTitleProps extends React.HTMLProps<PanelTitle> {
        componentClass?: string;
        bsClass?: string;
        toggle?: boolean;
    }
}
declare class PanelTitle extends React.Component<PanelTitle.PanelTitleProps> { }
export = PanelTitle;
