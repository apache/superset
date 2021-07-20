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
import { styled, t, useTheme } from '@superset-ui/core';
import { NativeGraySelect as Select } from 'src/components/Select';
import Icons from 'src/components/Icons';
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
};

interface NotificationMethodProps {
  setting?: NotificationSetting | null;
  index: number;
  onUpdate?: (index: number, updatedSetting: NotificationSetting) => void;
  onRemove?: (index: number) => void;
}

export const NotificationMethod: FunctionComponent<NotificationMethodProps> = ({
  setting = null,
  index,
  onUpdate,
  onRemove,
}) => {
  const { method, recipients, options } = setting || {};
  const [recipientValue, setRecipientValue] = useState<string>(
    recipients || '',
  );
  const theme = useTheme();

  if (!setting) {
    return null;
  }

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
            <Icons.Trash iconColor={theme.colors.grayscale.base} />
          </span>
        ) : null}
      </div>
      {method !== undefined ? (
        <StyledInputContainer>
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
