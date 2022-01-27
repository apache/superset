import { ControlType, ControlSetItem, ExpandedControlItem, ControlOverrides } from '../types';
export declare function expandControlType(controlType: ControlType): typeof import("../shared-controls/components/RadioButtonControl").default | typeof import("../shared-controls/components/ColumnConfigControl").default | ControlType;
/**
 * Expand a shorthand control config item to full config in the format of
 *   {
 *     name: ...,
 *     config: {
 *        type: ...,
 *        ...
 *     }
 *   }
 */
export declare function expandControlConfig(control: ControlSetItem, controlOverrides?: ControlOverrides): ExpandedControlItem;
//# sourceMappingURL=expandControlConfig.d.ts.map