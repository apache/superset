import * as React from 'react';
import { Sizes, TransitionCallbacks } from 'react-bootstrap';
import ModalBody = require('./ModalBody');
import ModalHeader = require('./ModalHeader');
import ModalTitle = require('./ModalTitle');
import ModalDialog = require('./ModalDialog');
import ModalFooter = require('./ModalFooter');

declare namespace Modal {
    interface ModalProps extends TransitionCallbacks, React.HTMLProps<Modal> {
        // Required
        onHide: Function;

        // Optional
        animation?: boolean;
        autoFocus?: boolean;
        backdrop?: boolean | string;
        backdropClassName?: string;
        backdropStyle?: any;
        backdropTransitionTimeout?: number;
        bsSize?: Sizes;
        bsClass?: string;
        container?: any; // TODO: Add more specific type
        containerClassName?: string;
        dialogClassName?: string;
        dialogComponent?: any; // TODO: Add more specific type
        dialogTransitionTimeout?: number;
        enforceFocus?: boolean;
        restoreFocus?: boolean;
        keyboard?: boolean;
        onBackdropClick?: (node: HTMLElement) => any;
        onEscapeKeyDown?: (node: HTMLElement) => any;
        /**
         * @deprecated since Sept 25, 2017, use onEscapeKeyDown instead
         **/
        onEscapeKeyUp?: (node: HTMLElement) => any;
        onShow?: (node: HTMLElement) => any;
        show?: boolean;
        transition?: React.ReactElement;
    }
}
declare class Modal extends React.Component<Modal.ModalProps> {
    static Body: typeof ModalBody;
    static Header: typeof ModalHeader;
    static Title: typeof ModalTitle;
    static Footer: typeof ModalFooter;
    static Dialog: typeof ModalDialog;
}
export = Modal;
