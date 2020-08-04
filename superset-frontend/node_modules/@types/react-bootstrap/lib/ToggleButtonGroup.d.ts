import * as React from 'react';
import { ButtonGroup } from 'react-bootstrap';
import { Omit } from "../index";

declare namespace ToggleButtonGroup {
  interface BaseProps {
    /**
     * You'll usually want to use string|number|string[]|number[] here,
     * but you can technically use any|any[].
     */
    defaultValue?: any;
    /**
     * You'll usually want to use string|number|string[]|number[] here,
     * but you can technically use any|any[].
     */
    value?: any;
  }

  interface RadioProps {
    /** Required if `type` is set to "radio" */
    name: string;
    type: "radio";
    onChange?(value: any): void;
  }

  interface CheckboxProps {
    name?: string;
    type: "checkbox";
    onChange?(values: any[]): void;
  }

  export type ToggleButtonGroupProps = BaseProps
    & (RadioProps | CheckboxProps)
    & Omit<ButtonGroup.ButtonGroupProps, "onChange">
    & Omit<React.HTMLProps<ToggleButtonGroup>, "defaultValue" | "type" | "value" | "onChange">;
}
declare class ToggleButtonGroup extends React.Component<ToggleButtonGroup.ToggleButtonGroupProps> { }
export = ToggleButtonGroup;
