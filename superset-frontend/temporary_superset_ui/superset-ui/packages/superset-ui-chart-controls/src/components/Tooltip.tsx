import React from 'react';
import { useTheme } from '@superset-ui/core';
import { Tooltip as BaseTooltip } from 'antd';
import { TooltipProps } from 'antd/lib/tooltip';

export { TooltipProps } from 'antd/lib/tooltip';

export const Tooltip = ({ overlayStyle, color, ...props }: TooltipProps) => {
  const theme = useTheme();
  const defaultColor = `${theme.colors.grayscale.dark2}e6`;
  return (
    <BaseTooltip
      overlayStyle={{ fontSize: theme.typography.sizes.s, lineHeight: '1.6', ...overlayStyle }}
      color={defaultColor || color}
      {...props}
    />
  );
};

export default Tooltip;
