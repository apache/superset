import * as React from 'react';

declare namespace NavbarToggle {
    export interface NavbarToggleProps extends React.HTMLProps<NavbarToggle> {
        onClick?: React.MouseEventHandler<any>;
    }
}
declare class NavbarToggle extends React.Component<NavbarToggle.NavbarToggleProps> { }
export = NavbarToggle;
