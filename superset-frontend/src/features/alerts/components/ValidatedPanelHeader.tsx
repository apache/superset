import React from 'react';
import { t } from '@superset-ui/core';
import { CheckCircleOutlined } from '@ant-design/icons';

const ValidatedPanelHeader = ({
  title,
  subtitle,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  required,
  validateCheckStatus,
}: {
  title: string;
  subtitle: string;
  required: boolean;
  validateCheckStatus: boolean;
}): JSX.Element => {
  const asterisk = ' *';
  const checkmark = <CheckCircleOutlined />;

  return (
    <div className="collapse-panel-header">
      <div className="collapse-panel-title">
        <span>{t(title)}</span>
        {validateCheckStatus ? (
          <span className="validation-checkmark">{checkmark}</span>
        ) : (
          <span className="collapse-panel-asterisk">{asterisk}</span>
        )}
      </div>
      <p className="collapse-panel-subtitle">
        {subtitle ? t(subtitle) : undefined}
      </p>
    </div>
  );
};

export default ValidatedPanelHeader;
