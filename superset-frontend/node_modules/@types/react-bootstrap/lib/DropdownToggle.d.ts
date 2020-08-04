import * as React from 'react';

declare namespace DropdownToggle {
    export interface DropdownToggleProps extends React.HTMLProps<DropdownToggle> {
        bsRole?: string;
        noCaret?: boolean;
        open?: boolean;
        title?: string;
        useAnchor?: boolean;
        bsClass?:string; // Added since v0.30.0
        bsStyle?:string | null;
        bsSize?:string;
    }
}
declare class DropdownToggle extends React.Component<DropdownToggle.DropdownToggleProps> { }
export = DropdownToggle;
