import * as React from 'react';
import { TransitionCallbacks, Sizes, SelectCallback } from 'react-bootstrap';
import PanelHeading = require('./PanelHeading');
import PanelTitle = require('./PanelTitle');
import PanelToggle = require('./PanelToggle');
import PanelCollapse = require('./PanelCollapse');
import PanelBody = require('./PanelBody');
import PanelFooter = require('./PanelFooter');

declare namespace Panel {
    export interface PanelProps extends TransitionCallbacks, React.HTMLProps<Panel> {
        bsStyle?: string;
        defaultExpanded?: boolean;
        eventKey?: any;
        expanded?: boolean;
        onSelect?: SelectCallback;
        onToggle?: SelectCallback;
    }
}
declare class Panel extends React.Component<Panel.PanelProps> {
    static Heading: typeof PanelHeading;
    static Title: typeof PanelTitle;
    static Toggle: typeof PanelToggle;
    static Collapse: typeof PanelCollapse;
    static Body: typeof PanelBody;
    static Footer: typeof PanelFooter;
}
export = Panel;
