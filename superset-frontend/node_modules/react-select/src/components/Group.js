// @flow
/** @jsx jsx */
import { type Node, type ComponentType } from 'react';
import { jsx } from '@emotion/core';

import type { CommonProps } from '../types';

type ComponentProps = {
  /** The children to be rendered. */
  children: Node,
  /** Component to wrap the label, recieves headingProps. */
  Heading: ComponentType<any>,
  /** Props to pass to Heading. */
  headingProps: any,
  /** Label to be displayed in the heading component. */
  label: Node,
};
export type GroupProps = CommonProps & ComponentProps;

export const groupCSS = ({ theme: { spacing } }: GroupProps) => ({
  paddingBottom: spacing.baseUnit * 2,
  paddingTop: spacing.baseUnit * 2,
});

const Group = (props: GroupProps) => {
  const {
    children,
    className,
    cx,
    getStyles,
    Heading,
    headingProps,
    label,
    theme,
    selectProps,
  } = props;
  return (
    <div
      css={getStyles('group', props)}
      className={cx({ group: true }, className)}
    >
      <Heading
        {...headingProps}
        selectProps={selectProps}
        theme={theme}
        getStyles={getStyles}
        cx={cx}
      >
        {label}
      </Heading>
      <div>{children}</div>
    </div>
  );
};

export const groupHeadingCSS = ({ theme: { spacing } }: GroupProps) => ({
  label: 'group',
  color: '#999',
  cursor: 'default',
  display: 'block',
  fontSize: '75%',
  fontWeight: '500',
  marginBottom: '0.25em',
  paddingLeft: spacing.baseUnit * 3,
  paddingRight: spacing.baseUnit * 3,
  textTransform: 'uppercase',
});

export const GroupHeading = (props: any) => {
  const { className, cx, getStyles, theme, selectProps, ...cleanProps } = props;
  return (
    <div
      css={getStyles('groupHeading', { theme, ...cleanProps })}
      className={cx({ 'group-heading': true }, className)}
      {...cleanProps}
    />
  );
};

export default Group;
