/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import { css, useTheme } from '@apache-superset/core/theme';
import {
  Icons,
  Modal,
  Tooltip,
  Typography,
} from '@superset-ui/core/components';
import type { ErrorAlertProps } from './types';

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  errorType = t('Error'),
  message,
  type = 'error',
  description,
  descriptionDetails,
  descriptionDetailsCollapsed = true,
  messagePre = false,
  descriptionPre = true,
  compact = false,
  children,
  closable = true,
  showIcon = true,
  className,
}) => {
  const [isDescriptionVisible, setIsDescriptionVisible] = useState(
    !descriptionDetailsCollapsed,
  );
  const [showModal, setShowModal] = useState(false);

  const toggleDescription = () => {
    setIsDescriptionVisible(!isDescriptionVisible);
  };

  const theme = useTheme();
  const renderTrigger = () => {
    const icon =
      type === 'warning' ? (
        <Icons.WarningOutlined />
      ) : (
        <Icons.ExclamationCircleOutlined />
      );
    const color =
      type === 'warning' ? theme.colorWarningText : theme.colorErrorText;
    return (
      <div className={className} style={{ cursor: 'pointer' }}>
        <span style={{ color }}>{icon} </span>
        {errorType}
      </div>
    );
  };
  const preStyle = {
    whiteSpace: 'pre-wrap' as const,
    fontFamily: theme.fontFamilyCode,
    margin: `${theme.sizeUnit}px 0`,
  };
  const renderDescription = () => (
    <div>
      {message &&
        (messagePre ? (
          <Typography.Paragraph style={preStyle}>
            {message}
          </Typography.Paragraph>
        ) : (
          <div>{message}</div>
        ))}
      {description && (
        <Typography.Paragraph
          style={descriptionPre ? preStyle : {}}
          data-testid="description"
        >
          {description}
        </Typography.Paragraph>
      )}
      {descriptionDetails && (
        <div>
          {isDescriptionVisible && (
            <Typography.Paragraph style={descriptionPre ? preStyle : {}}>
              {descriptionDetails}
            </Typography.Paragraph>
          )}
          <button
            type="button"
            onClick={toggleDescription}
            css={css`
              appearance: none;
              border: none;
              background: none;
              padding: 0;
              font: inherit;
              color: inherit;
            `}
            style={{ textDecoration: 'underline', cursor: 'pointer' }}
          >
            {isDescriptionVisible ? t('See less') : t('See more')}
          </button>
        </div>
      )}
      {children}
    </div>
  );
  const renderAlert = (closable: boolean) => (
    <Alert
      message={errorType}
      description={renderDescription()}
      type={type}
      showIcon={showIcon}
      closable={closable}
      className={className}
    />
  );

  if (compact) {
    return (
      <>
        <Tooltip title={`${errorType}: ${message}`}>
          <button
            type="button"
            css={css`
              appearance: none;
              border: none;
              background: none;
              padding: 0;
              font: inherit;
            `}
            onClick={() => setShowModal(true)}
          >
            {renderTrigger()}
          </button>
        </Tooltip>
        <Modal
          name={errorType}
          title={errorType}
          show={showModal}
          onHide={() => setShowModal(false)}
          footer={null}
        >
          {renderAlert(false)}
        </Modal>
      </>
    );
  }

  return renderAlert(closable);
};
