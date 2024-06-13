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
import {
  FunctionComponent,
  useState,
  ChangeEvent,
  useEffect,
  useMemo,
} from 'react';

import {
  FeatureFlag,
  SupersetClient,
  isFeatureEnabled,
  styled,
  t,
  useTheme,
} from '@superset-ui/core';
import rison from 'rison';
import { AsyncSelect, Select } from 'src/components';
import Icons from 'src/components/Icons';
import { NotificationMethodOption, NotificationSetting } from '../types';
import { StyledInputContainer } from '../AlertReportModal';

const StyledNotificationMethod = styled.div`
  margin-bottom: 10px;

  .input-container {
    textarea {
      height: auto;
    }

    &.error {
      input {
        border-color: ${({ theme }) => theme.colors.error.base};
      }
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

interface NotificationMethodProps {
  setting?: NotificationSetting | null;
  index: number;
  onUpdate?: (index: number, updatedSetting: NotificationSetting) => void;
  onRemove?: (index: number) => void;
  onInputChange?: (
    event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => void;
  email_subject: string;
  defaultSubject: string;
  setErrorSubject: (hasError: boolean) => void;
}

const TRANSLATIONS = {
  EMAIL_SUBJECT_NAME: t('Email subject name (optional)'),
  EMAIL_SUBJECT_ERROR_TEXT: t(
    'Please enter valid text. Spaces alone are not permitted.',
  ),
};

export const NotificationMethod: FunctionComponent<NotificationMethodProps> = ({
  setting = null,
  index,
  onUpdate,
  onRemove,
  onInputChange,
  email_subject,
  defaultSubject,
  setErrorSubject,
}) => {
  const { method, recipients, options } = setting || {};
  const [recipientValue, setRecipientValue] = useState<string>(
    recipients || '',
  );
  const [slackRecipients, setSlackRecipients] = useState<
    { label: string; value: string }[]
  >([]);
  const [error, setError] = useState(false);
  const theme = useTheme();

  const [useSlackV1, setUseSlackV1] = useState<boolean>(false);

  const mapChannelsToOptions = (result: { name: any; id: any }[]) =>
    result.map((result: { name: any; id: any }) => ({
      label: result.name,
      value: result.id,
    }));

  const loadChannels = async (
    search_string: string | undefined = '',
  ): Promise<{
    data: { label: any; value: any }[];
    totalCount: number;
  }> => {
    const query = rison.encode({ search_string });
    const endpoint = `/api/v1/report/slack_channels/?q=${query}`;
    const noResults = { data: [], totalCount: 0 };
    return SupersetClient.get({ endpoint })
      .then(({ json }) => {
        const { result, count } = json;

        const options: { label: any; value: any }[] =
          mapChannelsToOptions(result);

        return {
          data: options,
          totalCount: (count ?? options.length) as number,
        };
      })
      .catch(() => {
        // Fallback to slack v1 if slack v2 is not compatible
        setUseSlackV1(true);
        return noResults;
      });
  };
  const onMethodChange = (selected: {
    label: string;
    value: NotificationMethodOption;
  }) => {
    // Since we're swapping the method, reset the recipients
    setRecipientValue('');
    if (onUpdate && setting) {
      const updatedSetting = {
        ...setting,
        method: selected.value,
        recipients: '',
      };

      onUpdate(index, updatedSetting);
    }
  };

  useEffect(() => {
    // fetch slack channel names from
    // ids on first load
    if (method && ['Slack', 'SlackV2'].includes(method)) {
      loadChannels(recipients).then(response => {
        setSlackRecipients(response.data || []);
        // if fetch succeeds, set the method to SlackV2
        onMethodChange({ label: 'Slack', value: 'SlackV2' });
      });
    }
  }, []);

  const formattedOptions = useMemo(
    () =>
      (options || [])
        .filter(
          method =>
            (isFeatureEnabled(FeatureFlag.AlertReportSlackV2) &&
              !useSlackV1 &&
              method === 'SlackV2') ||
            ((!isFeatureEnabled(FeatureFlag.AlertReportSlackV2) ||
              useSlackV1) &&
              method === 'Slack') ||
            method === 'Email',
        )
        .map(method => ({
          label: method === 'SlackV2' ? 'Slack' : method,
          value: method,
        })),
    [options],
  );

  if (!setting) {
    return null;
  }

  const onRecipientsChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
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

  const onSlackRecipientsChange = (
    recipients: { label: string; value: string }[],
  ) => {
    setSlackRecipients(recipients);

    if (onUpdate) {
      const updatedSetting = {
        ...setting,
        recipients: recipients?.map(obj => obj.value).join(','),
      };

      onUpdate(index, updatedSetting);
    }
  };

  const onSubjectChange = (
    event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    const { value } = event.target;

    if (onInputChange) {
      onInputChange(event);
    }

    const hasError = value.length > 0 && value.trim().length === 0;
    setError(hasError);
    if (setErrorSubject) {
      setErrorSubject(hasError);
    }
  };

  // Set recipients
  if (!!recipients && recipientValue !== recipients) {
    setRecipientValue(recipients);
  }

  return (
    <StyledNotificationMethod>
      <div className="inline-container">
        <StyledInputContainer>
          <div className="control-label">{t('Notification Method')}</div>
          <div className="input-container">
            <Select
              ariaLabel={t('Delivery method')}
              data-test="select-delivery-method"
              labelInValue
              onChange={onMethodChange}
              placeholder={t('Select Delivery Method')}
              options={formattedOptions}
              showSearch
              value={formattedOptions.find(option => option.value === method)}
            />
            {index !== 0 && !!onRemove ? (
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
      {method !== undefined ? (
        <>
          <div className="inline-container">
            <StyledInputContainer>
              {method === 'Email' ? (
                <>
                  <div className="control-label">
                    {TRANSLATIONS.EMAIL_SUBJECT_NAME}
                  </div>
                  <div className={`input-container ${error ? 'error' : ''}`}>
                    <input
                      type="text"
                      name="email_subject"
                      value={email_subject}
                      placeholder={defaultSubject}
                      onChange={onSubjectChange}
                    />
                  </div>
                  {error && (
                    <div
                      style={{
                        color: theme.colors.error.base,
                        fontSize: theme.gridUnit * 3,
                      }}
                    >
                      {TRANSLATIONS.EMAIL_SUBJECT_ERROR_TEXT}
                    </div>
                  )}
                </>
              ) : null}
            </StyledInputContainer>
          </div>
          <div className="inline-container">
            <StyledInputContainer>
              <div className="control-label">
                {t('%s recipients', method === 'SlackV2' ? 'Slack' : method)}
                <span className="required">*</span>
              </div>
              <div>
                {['Email', 'Slack'].includes(method) ? (
                  <>
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
                  </>
                ) : (
                  // for SlackV2
                  <AsyncSelect
                    ariaLabel={t('Select channels')}
                    mode="multiple"
                    name="recipients"
                    value={slackRecipients}
                    options={loadChannels}
                    onChange={onSlackRecipientsChange}
                    allowClear
                    data-test="recipients"
                  />
                )}
              </div>
            </StyledInputContainer>
          </div>
        </>
      ) : null}
    </StyledNotificationMethod>
  );
};
