// DODO was here

import { forwardRef, MouseEvent, ReactNode, RefObject } from 'react';

import { css, styled, useTheme, t } from '@superset-ui/core';
import Icons from 'src/components/Icons';

export type DateLabelProps = {
  label: ReactNode;
  isActive?: boolean;
  isPlaceholder?: boolean;
  onClick?: (event: MouseEvent) => void;
};

// This is the color that antd components (such as Select or Input) use on hover
// TODO: use theme.colors.primary.base here and in antd components
// const ACTIVE_BORDER_COLOR = '#45BED6'; // DODO commented out 45047288

const LabelContainer = styled.div<{
  isActive?: boolean;
  isPlaceholder?: boolean;
}>`
  ${({ theme, isActive, isPlaceholder }) => css`
    width: 100%;
    height: ${theme.gridUnit * 8}px;

    display: flex;
    align-items: center;
    flex-wrap: nowrap;

    padding: 0 ${theme.gridUnit * 3}px;

    background-color: ${theme.colors.grayscale.light5};

    border: 1px solid
      ${isActive ? theme.colors.primary.base : theme.colors.grayscale.light2}; // DODO changed 45047288
    border-radius: ${theme.borderRadius}px;

    cursor: pointer;

    transition: border-color 0.3s cubic-bezier(0.65, 0.05, 0.36, 1);
    :hover,
    :focus {
      border-color: ${theme.colors.primary.base}; // DODO changed 45047288
    }

    .date-label-content {
      color: ${isPlaceholder
        ? theme.colors.grayscale.light1
        : theme.colors.grayscale.dark1};
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
      flex-shrink: 1;
      white-space: nowrap;
    }

    span[role='img'] {
      margin-left: auto;
      padding-left: ${theme.gridUnit}px;

      & > span[role='img'] {
        line-height: 0;
      }
    }
  `}
`;

export const DateLabel = forwardRef(
  (props: DateLabelProps, ref: RefObject<HTMLSpanElement>) => {
    const theme = useTheme();
    return (
      <LabelContainer {...props} tabIndex={0}>
        <span className="date-label-content" ref={ref}>
          {typeof props.label === 'string' ? t(props.label) : props.label}
        </span>
        <Icons.CalendarOutlined
          iconSize="s"
          iconColor={theme.colors.grayscale.base}
        />
      </LabelContainer>
    );
  },
);
