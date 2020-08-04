import { ReactNode, ComponentType } from 'react';

import { spacing } from '../theme';
import { CommonProps, OptionTypeBase } from '../types';

interface ComponentProps {
  /** The children to be rendered. */
  children: ReactNode;
  /** Component to wrap the label, recieves headingProps. */
  Heading: ComponentType<any>;
  /** Props to pass to Heading. */
  headingProps: any;
  /** Label to be displayed in the heading component. */
  label: ReactNode;
}
export type GroupProps<OptionType extends OptionTypeBase> = CommonProps<OptionType> & ComponentProps;

export function groupCSS(): React.CSSProperties;

export const Group: ComponentType<GroupProps<any>>;

export function groupHeadingCSS(): React.CSSProperties;

export const GroupHeading: ComponentType<any>;

export default Group;
