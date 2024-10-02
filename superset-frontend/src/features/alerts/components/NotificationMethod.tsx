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
import rison from 'rison';

import {
  FeatureFlag,
  JsonResponse,
  SupersetClient,
  isFeatureEnabled,
  styled,
  t,
  useTheme,
} from '@superset-ui/core';
import { Select } from 'src/components';
import Icons from 'src/components/Icons';
import {
  NotificationMethodOption,
  NotificationSetting,
  SlackChannel,
} from '../types';
import { StyledInputContainer } from '../AlertReportModal';

const StyledNotificationMethod = styled.div`
  ${({ theme }) => `
    margin-bottom: ${theme.gridUnit * 3}px;

    .input-container {
      textarea {
        height: auto;
      }

      &.error {
        input {
          border-color: ${theme.colors.error.base};
        }
      }

      .helper {
        margin-top: ${theme.gridUnit * 2}px;
        font-size: ${theme.typography.sizes.s}px;
        color: ${theme.colors.grayscale.base};
      }
    }

    .inline-container {
      margin-bottom: ${theme.gridUnit * 2}px;

      > div {
        margin: 0px;
      }

      .delete-button {
        margin-left: ${theme.gridUnit * 2}px;
        padding-top: ${theme.gridUnit}px;
      }
    }

    .ghost-button {
      color: ${theme.colors.primary.dark1};
      display: inline-flex;
      align-items: center;
      font-size: ${theme.typography.sizes.s}px;
      cursor: pointer;
      margin-top: ${theme.gridUnit}px;

      .icon {
        width: ${theme.gridUnit * 3}px;
        height: ${theme.gridUnit * 3}px;
        font-size: ${theme.typography.sizes.s}px;
        margin-right: ${theme.gridUnit}px;
      }
    }

    .ghost-button + .ghost-button {
      margin-left: ${theme.gridUnit * 4}px;
    }

    .ghost-button:first-child[style*='none'] + .ghost-button {
      margin-left: 0px; /* Remove margin when the first button is hidden */
    }
  `}
`;

const TRANSLATIONS = {
  EMAIL_CC_NAME: t('CC recipients'),
  EMAIL_BCC_NAME: t('BCC recipients'),
  EMAIL_SUBJECT_NAME: t('Email subject name (optional)'),
  EMAIL_SUBJECT_ERROR_TEXT: t(
    'Please enter valid text. Spaces alone are not permitted.',
  ),
};

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

export const mapSlackValues = ({
  method,
  recipientValue,
  slackOptions,
}: {
  method: string;
  recipientValue: string;
  slackOptions: { label: string; value: string }[];
}) => {
  const prop = method === NotificationMethodOption.SlackV2 ? 'value' : 'label';
  return recipientValue
    .split(',')
    .map(recipient =>
      slackOptions.find(
        option =>
          option[prop].trim().toLowerCase() === recipient.trim().toLowerCase(),
      ),
    )
    .filter(val => !!val) as { label: string; value: string }[];
};

export const mapChannelsToOptions = (result: SlackChannel[]) => {
  const publicChannels: SlackChannel[] = [];
  const privateChannels: SlackChannel[] = [];

  result.forEach(channel => {
    if (channel.is_private) {
      privateChannels.push(channel);
    } else {
      publicChannels.push(channel);
    }
  });

  return [
    {
      label: 'Public Channels',
      options: publicChannels.map((channel: SlackChannel) => ({
        label: `${channel.name} ${
          channel.is_member ? '' : t('(Bot not in channel)')
        }`,
        value: channel.id,
        key: channel.id,
      })),
      key: 'public',
    },
    {
      label: t('Private Channels (Bot in channel)'),
      options: privateChannels.map((channel: SlackChannel) => ({
        label: channel.name,
        value: channel.id,
        key: channel.id,
      })),
      key: 'private',
    },
  ];
};

type SlackOptionsType = {
  label: string;
  options: { label: string; value: string }[];
}[];

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
  const { method, recipients, cc, bcc, options } = setting || {};
  const [recipientValue, setRecipientValue] = useState<string>(
    recipients || '',
  );
  const [slackRecipients, setSlackRecipients] = useState<
    { label: string; value: string }[]
  >([]);
  const [error, setError] = useState(false);
  const [ccVisible, setCcVisible] = useState<boolean>(!!cc);
  const [bccVisible, setBccVisible] = useState<boolean>(!!bcc);
  const [ccValue, setCcValue] = useState<string>(cc || '');
  const [bccValue, setBccValue] = useState<string>(bcc || '');
  const theme = useTheme();
  const [methodOptionsLoading, setMethodOptionsLoading] =
    useState<boolean>(true);
  const [slackOptions, setSlackOptions] = useState<SlackOptionsType>([
    {
      label: '',
      options: [],
    },
  ]);

  const [useSlackV1, setUseSlackV1] = useState<boolean>(false);

  const onMethodChange = (selected: {
    label: string;
    value: NotificationMethodOption;
  }) => {
    // Since we're swapping the method, reset the recipients
    setRecipientValue('');
    setCcValue('');
    setBccValue('');

    if (onUpdate && setting) {
      const updatedSetting = {
        ...setting,
        method: selected.value,
        recipients: '',
        cc: '',
        bcc: '',
      };

      onUpdate(index, updatedSetting);
    }
  };

  const fetchSlackChannels = async ({
    searchString = '',
    types = [],
    exactMatch = false,
  }: {
    searchString?: string | undefined;
    types?: string[];
    exactMatch?: boolean | undefined;
  } = {}): Promise<JsonResponse> => {
    const queryString = rison.encode({ searchString, types, exactMatch });
    const endpoint = `/api/v1/report/slack_channels/?q=${queryString}`;
    return SupersetClient.get({ endpoint });
  };

  useEffect(() => {
    const slackEnabled = options?.some(
      option =>
        option === NotificationMethodOption.Slack ||
        option === NotificationMethodOption.SlackV2,
    );
    if (slackEnabled && !slackOptions[0]?.options.length) {
      fetchSlackChannels({ types: ['public_channel', 'private_channel'] })
        .then(({ json }) => {
          const { result } = json;
          const options: SlackOptionsType = mapChannelsToOptions(result);

          setSlackOptions(options);

          if (isFeatureEnabled(FeatureFlag.AlertReportSlackV2)) {
            // for edit mode, map existing ids to names for display if slack v2
            // or names to ids if slack v1
            const [publicOptions, privateOptions] = options;
            if (
              method &&
              [
                NotificationMethodOption.SlackV2,
                NotificationMethodOption.Slack,
              ].includes(method)
            ) {
              setSlackRecipients(
                mapSlackValues({
                  method,
                  recipientValue,
                  slackOptions: [
                    ...publicOptions.options,
                    ...privateOptions.options,
                  ],
                }),
              );
            }
          }
        })
        .catch(e => {
          // Fallback to slack v1 if slack v2 is not compatible
          setUseSlackV1(true);
        })
        .finally(() => {
          setMethodOptionsLoading(false);
        });
    }
  }, []);

  const methodOptions = useMemo(
    () =>
      (options || [])
        .filter(
          method =>
            (isFeatureEnabled(FeatureFlag.AlertReportSlackV2) &&
              !useSlackV1 &&
              method === NotificationMethodOption.SlackV2) ||
            ((!isFeatureEnabled(FeatureFlag.AlertReportSlackV2) ||
              useSlackV1) &&
              method === NotificationMethodOption.Slack) ||
            method === NotificationMethodOption.Email,
        )
        .map(method => ({
          label:
            method === NotificationMethodOption.SlackV2
              ? NotificationMethodOption.Slack
              : method,
          value: method,
        })),
    [options, useSlackV1],
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

  const onCcChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { target } = event;

    setCcValue(target.value);

    if (onUpdate) {
      const updatedSetting = {
        ...setting,
        cc: target.value,
      };

      onUpdate(index, updatedSetting);
    }
  };

  const onBccChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { target } = event;

    setBccValue(target.value);

    if (onUpdate) {
      const updatedSetting = {
        ...setting,
        bcc: target.value,
      };

      onUpdate(index, updatedSetting);
    }
  };

  // Set recipients
  if (!!recipients && recipientValue !== recipients) {
    setRecipientValue(recipients);
  }

  if (!!cc && ccValue !== cc) {
    setCcValue(cc);
  }

  if (!!bcc && bccValue !== bcc) {
    setBccValue(bcc);
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
              options={methodOptions}
              showSearch
              value={methodOptions.find(option => option.value === method)}
              loading={methodOptionsLoading}
            />
            {index !== 0 && !!onRemove ? (
              // eslint-disable-next-line jsx-a11y/control-has-associated-label
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
              {method === NotificationMethodOption.Email ? (
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
                {t(
                  '%s recipients',
                  method === NotificationMethodOption.SlackV2
                    ? NotificationMethodOption.Slack
                    : method,
                )}
                <span className="required">*</span>
              </div>
              <div>
                {[
                  NotificationMethodOption.Email,
                  NotificationMethodOption.Slack,
                ].includes(method) ? (
                  <>
                    <div className="input-container">
                      <textarea
                        name="To"
                        data-test="recipients"
                        value={recipientValue}
                        onChange={onRecipientsChange}
                      />
                    </div>
                    <div className="input-container">
                      <div className="helper">
                        {t('Recipients are separated by "," or ";"')}
                      </div>
                    </div>
                  </>
                ) : (
                  // for SlackV2
                  <Select
                    ariaLabel={t('Select channels')}
                    mode="multiple"
                    name="recipients"
                    value={slackRecipients}
                    options={slackOptions}
                    onChange={onSlackRecipientsChange}
                    allowClear
                    data-test="recipients"
                    allowSelectAll={false}
                    labelInValue
                  />
                )}
              </div>
            </StyledInputContainer>
          </div>
          {method === NotificationMethodOption.Email && (
            <StyledInputContainer>
              {/* Render "CC" input field if ccVisible is true */}
              {ccVisible && (
                <>
                  <div className="control-label">
                    {TRANSLATIONS.EMAIL_CC_NAME}
                  </div>
                  <div className="input-container">
                    <textarea
                      name="CC"
                      data-test="cc"
                      value={ccValue}
                      onChange={onCcChange}
                    />
                  </div>
                  <div className="input-container">
                    <div className="helper">
                      {t('Recipients are separated by "," or ";"')}
                    </div>
                  </div>
                </>
              )}
              {/* Render "BCC" input field if bccVisible is true */}
              {bccVisible && (
                <>
                  <div className="control-label">
                    {TRANSLATIONS.EMAIL_BCC_NAME}
                  </div>
                  <div className="input-container">
                    <textarea
                      name="BCC"
                      data-test="bcc"
                      value={bccValue}
                      onChange={onBccChange}
                    />
                  </div>
                  <div className="input-container">
                    <div className="helper">
                      {t('Recipients are separated by "," or ";"')}
                    </div>
                  </div>
                </>
              )}
              {/* New buttons container */}
              <div className="ghost-button">
                <span
                  className="ghost-button"
                  role="button"
                  tabIndex={0}
                  onClick={() => setCcVisible(true)}
                  style={{ display: ccVisible ? 'none' : 'inline-flex' }}
                >
                  <Icons.Email className="icon" />
                  {t('Add CC Recipients')}
                </span>
                <span
                  className="ghost-button"
                  role="button"
                  tabIndex={0}
                  onClick={() => setBccVisible(true)}
                  style={{ display: bccVisible ? 'none' : 'inline-flex' }}
                >
                  <Icons.Email className="icon" />
                  {t('Add BCC Recipients')}
                </span>
              </div>
            </StyledInputContainer>
          )}
        </>
      ) : null}
    </StyledNotificationMethod>
  );
};
