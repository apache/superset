import * as React from 'react';

declare namespace TabContent {
    export interface TabContentProps extends React.HTMLProps<TabContent> {
        componentClass?: React.ReactType,
        animation?: boolean | React.ReactType;
        mountOnEnter?: boolean;
        unmountOnExit?: boolean;
        bsClass?: string;
    }
}
declare class TabContent extends React.Component<TabContent.TabContentProps> { }
export = TabContent;
