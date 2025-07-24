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
import { t, useTheme } from '@superset-ui/core';
import {
  Alert,
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
    whiteSpace: 'pre-wrap',
    fontFamily: theme.fontFamilyCode,
    margin: `${theme.sizeUnit}px 0`,
  };
  const renderDescription = () => (
    <div>
      {message && <div>{message}</div>}
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
          <span
            role="button"
            tabIndex={0}
            onClick={toggleDescription}
            style={{ textDecoration: 'underline', cursor: 'pointer' }}
          >
            {isDescriptionVisible ? t('See less') : t('See more')}
          </span>
        </div>
      )}
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
          <span role="button" onClick={() => setShowModal(true)} tabIndex={0}>
            {renderTrigger()}
          </span>
        </Tooltip>
        <Modal
          name={errorType}
          title={errorType}
          show={showModal}
          onHide={() => setShowModal(false)}
          footer={null}
        >
          {renderAlert(false)}
          {children}
        </Modal>
      </>
    );
  }

  return renderAlert(closable);
};
