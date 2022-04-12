import { css, SupersetTheme } from '@superset-ui/core';

export const antdWarningAlertStyles = (theme: SupersetTheme) => css`
  border: 1px solid ${theme.colors.warning.light1};
  padding: ${theme.gridUnit * 4}px;
  margin: ${theme.gridUnit * 4}px 0;
  color: ${theme.colors.warning.dark2};

  .ant-alert-message {
    margin: 0;
  }

  .ant-alert-description {
    font-size: ${theme.typography.sizes.s + 1}px;
    line-height: ${theme.gridUnit * 4}px;

    .ant-alert-icon {
      margin-right: ${theme.gridUnit * 2.5}px;
      font-size: ${theme.typography.sizes.l + 1}px;
      position: relative;
      top: ${theme.gridUnit / 4}px;
    }
  }
`;
