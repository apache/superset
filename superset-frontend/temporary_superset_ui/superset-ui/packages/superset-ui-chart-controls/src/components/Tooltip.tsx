import React from 'react';
import { useTheme, css } from '@superset-ui/core';
import { Tooltip as BaseTooltip } from 'antd';
import { TooltipProps } from 'antd/lib/tooltip';
import { Global } from '@emotion/react';

export { TooltipProps } from 'antd/lib/tooltip';

export const Tooltip = ({ overlayStyle, color, ...props }: TooltipProps) => {
  const theme = useTheme();
  const defaultColor = `${theme.colors.grayscale.dark2}e6`;
  return (
    <>
      {/* Safari hack to hide browser default tooltips */}
      <Global
        styles={css`
          .ant-tooltip-open {
            display: inline-block;
            &::after {
              content: '';
              display: block;
            }
          }
        `}
      />
      <BaseTooltip
        overlayStyle={{ fontSize: theme.typography.sizes.s, lineHeight: '1.6', ...overlayStyle }}
        color={defaultColor || color}
        {...props}
      />
    </>
  );
};

export default Tooltip;
