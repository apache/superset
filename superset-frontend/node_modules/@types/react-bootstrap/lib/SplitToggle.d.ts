import * as React from 'react';
import { DropdownToggleProps } from './DropdownToggle';

declare namespace SplitToggle {
    export type SplitToggleProps = DropdownToggleProps & React.HTMLProps<SplitToggle>;
}
declare class SplitToggle extends React.Component<SplitToggle.SplitToggleProps> { }
export = SplitToggle;
