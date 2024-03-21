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
import React, { FunctionComponent, useEffect, useState } from 'react';
import { styled, t, useTheme } from '@superset-ui/core';
import { Select } from 'src/components';
import Icons from 'src/components/Icons';
import LabeledErrorBoundInput from 'src/components/Form/LabeledErrorBoundInput';
import { noBottomMargin } from 'src/features/reports/ReportModal/styles';
import { NotificationMethodOption } from '../types';
import { StyledInputContainer } from '../AlertReportModal';

const StyledNotificationMethod = styled.div`
  margin-bottom: 10px;

  .input-container {
    textarea {
      height: auto;
    }
  }

  .inline-container {
    margin-bottom: 10px;

    > div {
      margin: 0;
    }

    .delete-button {
      margin-left: 10px;
      padding-top: 3px;
    }
  }
`;

type NotificationSetting = {
  method?: NotificationMethodOption;
  recipients: string;
  options: NotificationMethodOption[];
};

interface NotificationMethodProps {
  setting?: NotificationSetting | null;
  s3Setting: any;
  index: number;
  onUpdate?: (index: number, updatedSetting: NotificationSetting) => void;
  onRemove?: (index: number) => void;
  onUpdateS3Setting?: (updatedS3Setting: any) => void;
  currentAlert?: {
    aws_key: string;
    aws_S3_types: string;
    aws_secret_key: string;
  };
  isEditMode?: boolean;
}

export const NotificationMethod: FunctionComponent<NotificationMethodProps> = ({
  setting = null,
  s3Setting,
  index,
  onUpdate,
  onRemove,
  onUpdateS3Setting,
  currentAlert,
}) => {
  const { method, recipients, options } = setting || {};
  const [recipientValue, setRecipientValue] = useState<string>(
    recipients || '',
  );
  const theme = useTheme();
  const s3SubTypes = ['AWS_S3_credentials', 'AWS_S3_pyconfig', 'AWS_S3_IAM'];

  const [s3Method, setS3Method] = useState<string | null>(
    currentAlert ? currentAlert?.aws_S3_types : null,
  );
  const [accessKey, setAccessKey] = useState<string>(
    currentAlert ? currentAlert?.aws_key : '',
  );
  const [secretKey, setSecretKey] = useState<string>(
    currentAlert ? currentAlert?.aws_secret_key : '',
  );
  useEffect(() => {
    if (setting) {
      if (onUpdateS3Setting && currentAlert) {
        const updatedS3Setting = {
          ...s3Setting,
          aws_secret_key: secret_key,
          aws_S3_types: s3Method,
          aws_key: accessKey,
        };
        onUpdateS3Setting(updatedS3Setting);
      }
    }
  }, []);

  if (!setting) {
    return null;
  }
  const onMethodChange = (method: NotificationMethodOption) => {
    // Since we're swapping the method, reset the recipients
    setRecipientValue('');
    if (onUpdate) {
      const updatedSetting = {
        ...setting,
        method,
        recipients: '',
      };

      onUpdate(index, updatedSetting);
    }
  };
  const onRecipientsChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const { target } = event;

    setRecipientValue(target.value);

    if (onUpdate) {
      const updatedSetting = {
        ...setting,
        recipients: target.value,
      };

      onUpdate(index, updatedSetting);
    }
  };

  // Set recipients
  if (!!recipients && recipientValue !== recipients) {
    setRecipientValue(recipients);
  }
  const handleS3Method = (e: any) => {
    setS3Method(e);
    if (onUpdateS3Setting) {
      const updatedS3Setting = {
        ...s3Setting,
        aws_S3_types: e,
      };

      onUpdateS3Setting(updatedS3Setting);
    }
  };
  const handleAccesskey = (e: any) => {
    setAccessKey(e.target.value);
    if (onUpdateS3Setting) {
      const updatedS3Setting = {
        ...s3Setting,
        aws_key: e.target.value,
      };

      onUpdateS3Setting(updatedS3Setting);
    }
  };

  const handleSecretkey = (e: any) => {
    setSecretKey(e.target.value);
    if (onUpdateS3Setting) {
      const updatedS3Setting = {
        ...s3Setting,
        aws_secret_key: e.target.value,
      };

      onUpdateS3Setting(updatedS3Setting);
    }
  };

  const handleBucketName = (e: any) => {
    const newBucketName = e.target.value;
    setRecipientValue(newBucketName);
    if (onUpdate) {
      const updatedSetting = {
        ...setting,
        recipients: newBucketName,
      };

      onUpdate(index, updatedSetting);
    }
  };

  return (
    <StyledNotificationMethod>
      <div className="inline-container">
        <StyledInputContainer>
          <div className="control-label">{t('Notification Method')}</div>
          <div className="input-container">
            <Select
              ariaLabel={t('Delivery method')}
              data-test="select-delivery-method"
              onChange={onMethodChange}
              placeholder={t('Select Delivery Method')}
              options={(options || []).map(
                (method: NotificationMethodOption) => ({
                  label: method,
                  value: method,
                }),
              )}
              value={method}
            />
            {method !== undefined && index !== 0 && !!onRemove ? (
              <span
                role="button"
                tabIndex={0}
                className="delete-button"
                onClick={() => onRemove(index)}
              >
                <Icons.Trash iconColor={theme.colors.grayscale.base} />
              </span>
            ) : null}
          </div>
        </StyledInputContainer>
      </div>
      {method === 'S3' && (
        <div className="inline-container">
          <StyledInputContainer>
            <div className="input-container">
              <Select
                ariaLabel={t('S3 methods')}
                data-test="select-delivery-method"
                onChange={handleS3Method}
                placeholder={t('Select S3 Method')}
                options={s3SubTypes.map((option: string) => ({
                  label: option,
                  value: option,
                }))}
                value={currentAlert ? currentAlert?.aws_S3_types : s3Method}
              />
            </div>
          </StyledInputContainer>
        </div>
      )}
      {s3Method ===
        ('AWS_S3_credentials' ||
          currentAlert?.aws_S3_types === 'AWS_S3_credentials') &&
        method !== 'Email' && (
          <div>
            <div className="control-label">{t('Bucket Name')}</div>
            <LabeledErrorBoundInput
              type="text"
              placeholder={t('Type[Bucket Name]')}
              name="bucketName"
              value={recipientValue}
              validationMethods={{
                onChange: handleBucketName,
              }}
              css={noBottomMargin}
            />

            <div className="control-label">{t('Access Key')}</div>
            <LabeledErrorBoundInput
              type="password"
              placeholder={t('Type[Access Key]')}
              name="accessKey"
              value={accessKey}
              validationMethods={{
                onChange: handleAccesskey,
              }}
              css={noBottomMargin}
            />
            <div className="control-label">{t('Secret Key')}</div>
            <LabeledErrorBoundInput
              type="password"
              placeholder={t('Type[Secret Key]')}
              name="secretKey"
              value={secretKey}
              validationMethods={{
                onChange: handleSecretkey,
              }}
              css={noBottomMargin}
            />
          </div>
        )}

      {(s3Method === 'AWS_S3_pyconfig' || s3Method === 'AWS_S3_IAM') &&
        method !== 'Email' && (
          <>
            <div className="control-label">{t('Bucket Name')}</div>
            <LabeledErrorBoundInput
              type="text"
              placeholder="Type[Bucket Name]"
              name="bucketName"
              value={recipientValue}
              validationMethods={{
                onChange: handleBucketName,
              }}
              css={noBottomMargin}
            />
          </>
        )}
      {(method !== undefined && method === 'Email') || method === 'Slack' ? (
        <StyledInputContainer>
          <div className="control-label">
            {t('%s recipients', method)}
            <span className="required">*</span>
          </div>
          <div className="input-container">
            <textarea
              name="recipients"
              data-test="recipients"
              value={recipientValue}
              onChange={onRecipientsChange}
            />
          </div>
          <div className="helper">
            {t('Recipients are separated by "," or ";"')}
          </div>
        </StyledInputContainer>
      ) : null}
    </StyledNotificationMethod>
  );
};
