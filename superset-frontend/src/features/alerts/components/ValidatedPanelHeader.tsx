import React from 'react';
import { t } from '@superset-ui/core';
import { CheckCircleOutlined } from '@ant-design/icons';

const ValidatedPanelHeader = ({
  title,
  subtitle,
  required,
  validateCheckStatus,
}: {
  title: string;
  subtitle: string;
  required: boolean;
  validateCheckStatus: boolean;
}): JSX.Element => {
  let asterisk;
  if (required) {
    asterisk = ' *';
  }

  let checkmark;
  if (validateCheckStatus) {
    checkmark = <CheckCircleOutlined />;
  }

  return (
    <div className="collapse-panel-header">
      <div className="collapse-panel-title">
        <span>{t(title)}</span>
        <span className="collapse-panel-asterisk">{asterisk}</span>
        <span className="validation-checkmark">{checkmark}</span>
      </div>
      <p className="collapse-panel-subtitle">
        {subtitle ? t(subtitle) : undefined}
      </p>
    </div>
  );
};

export default ValidatedPanelHeader;
