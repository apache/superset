import * as React from 'react';
import { SelectCallback } from 'react-bootstrap';

declare namespace PagerItem {
    export interface PagerItemProps extends React.HTMLProps<PagerItem> {
        disabled?: boolean;
        eventKey?: any;
        next?: boolean;
        onSelect?: SelectCallback;
        previous?: boolean;
        target?: string;
    }
}
declare class PagerItem extends React.Component<PagerItem.PagerItemProps> { }
export = PagerItem;
