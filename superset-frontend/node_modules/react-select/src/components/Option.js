// @flow
/** @jsx jsx */
import { type Node } from 'react';
import { jsx } from '@emotion/core';

import type { CommonProps, PropsWithStyles, InnerRef } from '../types';

type State = {
  /** Whether the option is disabled. */
  isDisabled: boolean,
  /** Whether the option is focused. */
  isFocused: boolean,
  /** Whether the option is selected. */
  isSelected: boolean,
};
type InnerProps = {
  id: string,
  key: string,
  onClick: MouseEventHandler,
  onMouseOver: MouseEventHandler,
  tabIndex: number,
};
export type OptionProps = PropsWithStyles &
  CommonProps &
  State & {
    /** The children to be rendered. */
    children: Node,
    /** Inner ref to DOM Node */
    innerRef: InnerRef,
    /** props passed to the wrapping element for the group. */
    innerProps: InnerProps,
    /* Text to be displayed representing the option. */
    label: string,
    /* Type is used by the menu to determine whether this is an option or a group.
    In the case of option this is always `option`. */
    type: 'option',
    /* The data of the selected option. */
    data: any,
  };

export const optionCSS = ({
  isDisabled,
  isFocused,
  isSelected,
  theme: { spacing, colors },
}: OptionProps) => ({
  label: 'option',
  backgroundColor: isSelected
    ? colors.primary
    : isFocused
    ? colors.primary25
    : 'transparent',
  color: isDisabled
    ? colors.neutral20
    : isSelected
    ? colors.neutral0
    : 'inherit',
  cursor: 'default',
  display: 'block',
  fontSize: 'inherit',
  padding: `${spacing.baseUnit * 2}px ${spacing.baseUnit * 3}px`,
  width: '100%',
  userSelect: 'none',
  WebkitTapHighlightColor: 'rgba(0, 0, 0, 0)',

  // provide some affordance on touch devices
  ':active': {
    backgroundColor:
      !isDisabled && (isSelected ? colors.primary : colors.primary50),
  },
});

const Option = (props: OptionProps) => {
  const {
    children,
    className,
    cx,
    getStyles,
    isDisabled,
    isFocused,
    isSelected,
    innerRef,
    innerProps,
  } = props;
  return (
    <div
      css={getStyles('option', props)}
      className={cx(
        {
          option: true,
          'option--is-disabled': isDisabled,
          'option--is-focused': isFocused,
          'option--is-selected': isSelected,
        },
        className
      )}
      ref={innerRef}
      {...innerProps}
    >
      {children}
    </div>
  );
};

export default Option;
