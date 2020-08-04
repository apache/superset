import * as React from 'react';
import { SelectCallback } from 'react-bootstrap';
import DropdownToggle = require('./DropdownToggle');
import DropdownMenu = require('./DropdownMenu');

declare namespace Dropdown {
    export interface DropdownBaseProps {
        bsClass?: string;
        componentClass?: React.ReactType;
        disabled?: boolean;
        dropup?: boolean;
        id: string;
        onClose?: Function;
        onSelect?: SelectCallback;
        onToggle?: (isOpen: boolean) => void;
        open?: boolean;
        pullRight?: boolean;
        role?: string;
    }

    export type DropdownProps = Dropdown.DropdownBaseProps & React.HTMLProps<Dropdown>;
}

declare class Dropdown extends React.Component<Dropdown.DropdownProps> {
  public static Menu: typeof DropdownMenu;
  public static Toggle: typeof DropdownToggle;
}
export = Dropdown;
