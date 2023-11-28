import React from 'react';
import { css, SupersetTheme } from '@superset-ui/core';
import { Collapse as AntdCollapse } from 'antd';
import { CollapsePanelProps } from 'antd/lib/collapse';

const anticonHeight = 12;
const antdPanelStyles = (theme: SupersetTheme) => css`
  .ant-collapse-header {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    padding: 0px ${theme.gridUnit * 4}px;
    background-color: ${theme.colors.grayscale.light4};
    border-bottom: 1px solid ${theme.colors.grayscale.light2};

    .anticon.anticon-right.ant-collapse-arrow {
      padding: 0;
      top: calc(50% - ${anticonHeight / 2}px);
    }

    .collapse-panel-title {
      font-size: ${theme.gridUnit * 4}px;
      font-weight: ${theme.typography.weights.bold};
      line-height: 130%;
    }

    .collapse-panel-subtitle {
      color: ${theme.colors.grayscale.base};
      font-size: ${theme.typography.sizes.s}px;
      font-weight: ${theme.typography.weights.normal};
      line-height: 150%;
      margin-bottom: 0;
      padding-top: ${theme.gridUnit}px;
    }

    .collapse-panel-asterisk {
      color: var(--semantic-error-base, ${theme.colors.warning.dark1});
    }
    .validation-checkmark {
      width: ${theme.gridUnit * 4}px;
      height: ${theme.gridUnit * 4}px;
      margin-left: ${theme.gridUnit}px;
      color: ${theme.colors.success.base};
    }
  }

  .ant-collapse-content-box {
    padding-top: ${theme.gridUnit * 2}px;
  }
`;

export interface PanelProps extends CollapsePanelProps {
  children?: React.ReactNode;
}
const StyledPanel = (props: PanelProps) => (
  <AntdCollapse.Panel
    css={(theme: SupersetTheme) => antdPanelStyles(theme)}
    {...props}
  />
);

export default StyledPanel;
