import React from 'react';
import { Global } from '@emotion/react';
import { css, useTheme } from '@superset-ui/core';

export const GlobalExploreStyles = () => {
  const theme = useTheme();

  return (
    <Global
      styles={css`
        .option-label {
          display: inline-block;
          & ~ i {
            margin-left: ${theme.gridUnit}px;
          }
        }
        .type-label {
          margin-right: ${theme.gridUnit * 2}px;
          width: ${theme.gridUnit * 7}px;
          display: inline-block;
          text-align: center;
          font-weight: ${theme.typography.weights.bold};
        }
        .edit-popover-resize {
          transform: scaleX(-1);
          -moz-transform: scaleX(-1);
          -webkit-transform: scaleX(-1);
          -ms-transform: scaleX(-1);
          float: right;
          margin-top: ${theme.gridUnit * 4}px;
          margin-right: ${theme.gridUnit * -2}px;
          cursor: nwse-resize;
        }
        .filter-sql-editor {
          border: ${theme.colors.grayscale.light2} solid thin;
        }
        .custom-sql-disabled-message {
          color: ${theme.colors.grayscale.light1};
          font-size: ${theme.typography.sizes.xs}px;
          text-align: center;
          margin-top: ${theme.gridUnit * 15}px;
        }
      `}
    />
  );
};
