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
import React, { FunctionComponent, useState } from 'react';
import { styled, t } from '@superset-ui/core';
import { NativeGraySelect as Select } from 'src/components/Select';
import { Radio } from 'src/common/components/Radio';
import Icon from 'src/components/Icon';
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

    .input-container {
      margin-left: 10px;
    }

    > div {
      margin: 0;
    }

    .delete-button {
      margin-left: 10px;
      padding-top: 3px;
    }
  }
`;

type NotificationMethod = 'Email' | 'Slack';

type NotificationSetting = {
  method?: NotificationMethod;
  recipients: string;
  options: NotificationMethod[];
  format: 'PNG' | 'CSV';
};

interface NotificationMethodProps {
  setting?: NotificationSetting | null;
  index: number;
  onUpdate?: (index: number, updatedSetting: NotificationSetting) => void;
  onRemove?: (index: number) => void;
  contentType: string;
}

export const NotificationMethod: FunctionComponent<NotificationMethodProps> = ({
  setting = null,
  index,
  contentType,
  onUpdate,
  onRemove,
}) => {
  const { method, recipients, options, format } = setting || {};
  const [recipientValue, setRecipientValue] = useState<string>(
    recipients || '',
  );
  const [formatValue, setFormatValue] = useState(format);

  if (!setting) {
    return null;
  }

  const onFormatChange = (event: any) => {
    const { target } = event;
    setFormatValue(target.value);

    if (onUpdate) {
      const updatedSetting = {
        ...setting,
        format: target.value,
      };

      onUpdate(index, updatedSetting);
    }
  };

  const onMethodChange = (method: NotificationMethod) => {
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

  const methodOptions = (options || []).map((method: NotificationMethod) => (
    <Select.Option key={method} value={method}>
      {t(method)}
    </Select.Option>
  ));

  return (
    <StyledNotificationMethod>
      <div className="inline-container">
        <StyledInputContainer>
          <div className="input-container">
            <Select
              data-test="select-delivery-method"
              onChange={onMethodChange}
              placeholder="Select Delivery Method"
              defaultValue={method}
              value={method}
            >
              {methodOptions}
            </Select>
          </div>
        </StyledInputContainer>
        {method !== undefined && !!onRemove ? (
          <span
            role="button"
            tabIndex={0}
            className="delete-button"
            onClick={() => onRemove(index)}
          >
            <Icon name="trash" />
          </span>
        ) : null}
      </div>
      {method !== undefined ? (
        <StyledInputContainer>
          {contentType === 'chart' && (
            <>
              <div className="control-label">{t('format')}</div>
              <Radio.Group onChange={onFormatChange} value={formatValue}>
                <Radio value="PNG">PNG</Radio>
                <Radio value="CSV">CSV</Radio>
              </Radio.Group>
            </>
          )}
          <div className="control-label">{t(method)}</div>
          <div className="input-container">
            <textarea
              name="recipients"
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
