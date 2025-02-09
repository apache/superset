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
import { Tooltip } from 'src/components/Tooltip';
import Modal from 'src/components/Modal';
import { ExclamationCircleOutlined, WarningOutlined } from '@ant-design/icons';
import Alert from 'src/components/Alert';
import { t, useTheme } from '@superset-ui/core';

export interface ErrorAlertProps {
  errorType?: string; // Strong text on the first line
  message: React.ReactNode | string; // Text shown on the first line
  type?: 'warning' | 'error' | 'info'; // Allows only 'warning' or 'error'
  description?: React.ReactNode; // Text shown under the first line, not collapsible
  descriptionDetails?: React.ReactNode | string; // Text shown under the first line, collapsible
  descriptionDetailsCollapsed?: boolean; // Hides the collapsible section unless "Show more" is clicked, default true
  descriptionPre?: boolean; // Uses pre-style to break lines, default true
  compact?: boolean; // Shows the error icon with tooltip and modal, default false
  children?: React.ReactNode; // Additional content to show in the modal
  closable?: boolean; // Show close button, default true
  showIcon?: boolean; // Show icon, default true
  className?: string;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({
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
      type === 'warning' ? <WarningOutlined /> : <ExclamationCircleOutlined />;
    const color =
      type === 'warning' ? theme.colors.warning.base : theme.colors.error.base;
    return (
      <div className={className} style={{ cursor: 'pointer' }}>
        <span style={{ color }}>{icon} </span>
        {errorType}
      </div>
    );
  };
  const preStyle = {
    whiteSpace: 'pre-wrap',
    fontFamily: theme.typography.families.sansSerif,
  };
  const renderDescription = () => (
    <div>
      {description && (
        <p style={descriptionPre ? preStyle : {}} data-testid="description">
          {description}
        </p>
      )}
      {descriptionDetails && (
        <div>
          {isDescriptionVisible && (
            <p style={descriptionPre ? preStyle : {}}>{descriptionDetails}</p>
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
      description={renderDescription()}
      type={type}
      showIcon
      closable={closable}
      className={className}
    >
      <strong>{errorType}</strong>
      {message && (
        <>
          : <span>{message}</span>
        </>
      )}
    </Alert>
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

export default ErrorAlert;
