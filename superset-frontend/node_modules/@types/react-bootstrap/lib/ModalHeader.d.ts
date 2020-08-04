import * as React from 'react';

declare namespace ModalHeader {
    export interface ModalHeaderProps extends React.HTMLProps<ModalHeader> {
        closeButton?: boolean;
        closeLabel?: string;
        onHide?: Function;
        bsClass?: string;
    }
}
declare class ModalHeader extends React.Component<ModalHeader.ModalHeaderProps> { }
export = ModalHeader;
