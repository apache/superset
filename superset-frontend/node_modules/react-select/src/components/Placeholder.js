// @flow
/** @jsx jsx */
import { type Node } from 'react';
import { jsx } from '@emotion/core';
import type { CommonProps } from '../types';

export type PlaceholderProps = CommonProps & {
  /** The children to be rendered. */
  children: Node,
  /** props passed to the wrapping element for the group. */
  innerProps: { [string]: any },
};

export const placeholderCSS = ({
  theme: { spacing, colors },
}: PlaceholderProps) => ({
  label: 'placeholder',
  color: colors.neutral50,
  marginLeft: spacing.baseUnit / 2,
  marginRight: spacing.baseUnit / 2,
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
});

const Placeholder = (props: PlaceholderProps) => {
  const { children, className, cx, getStyles, innerProps } = props;
  return (
    <div
      css={getStyles('placeholder', props)}
      className={cx(
        {
          placeholder: true,
        },
        className
      )}
      {...innerProps}
    >
      {children}
    </div>
  );
};

export default Placeholder;
