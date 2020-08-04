import * as React from 'react';
import { SelectCallback } from 'react-bootstrap';

declare namespace DropdownMenu {
    export interface DropdownMenuProps extends React.HTMLProps<DropdownMenu> {
        labelledBy?: string | number;
        onClose?: Function;
        onSelect?: SelectCallback;
        open?: boolean;
        pullRight?: boolean;
    }
}
declare class DropdownMenu extends React.Component<DropdownMenu.DropdownMenuProps> { }
export = DropdownMenu;
