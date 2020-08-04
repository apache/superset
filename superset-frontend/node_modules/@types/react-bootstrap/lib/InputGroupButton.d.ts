import * as React from 'react';

declare namespace InputGroupButton {
    export interface InputGroupButtonProps extends React.HTMLProps<InputGroupButton> {
        bsClass?: string;
    }
}
declare class InputGroupButton extends React.Component<InputGroupButton.InputGroupButtonProps> { }
export = InputGroupButton;
