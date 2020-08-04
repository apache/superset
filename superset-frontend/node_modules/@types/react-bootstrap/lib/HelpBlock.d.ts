import * as React from 'react';

declare namespace HelpBlock {
    export interface HelpBlockProps extends React.HTMLProps<HelpBlock> {
        bsClass?: string;
    }
}
declare class HelpBlock extends React.Component<HelpBlock.HelpBlockProps> { }
export = HelpBlock;
