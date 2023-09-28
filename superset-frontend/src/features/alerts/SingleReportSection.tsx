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

import React, { useCallback, useEffect, useState } from 'react';
import { css, isDefined, SupersetClient, t, useTheme } from '@superset-ui/core';
import pick from 'lodash/pick';
import { useSelector } from 'react-redux';
import Button from 'src/components/Button';
import { Select } from 'src/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { RootState } from 'src/dashboard/types';
import { Tooltip } from 'src/components/Tooltip';
import Icons from 'src/components/Icons';
import { AlertObject, MetaObject, Recipient } from './types';
import {
  DEFAULT_NOTIFICATION_FORMAT,
  NotificationSetting,
  StyledSectionTitle,
} from './AlertReportModal';
import { noOp } from '../../utils/common';

export interface SingleReportSectionProps {
  notificationSettings: NotificationSetting[];
  currentAlert?: Partial<AlertObject> | null;
  contentType: string;
  reportFormat: string;

  isReport: boolean;
  forceScreenshot: boolean;
}

enum SingleNotificationTarget {
  SEND_TO_ME = 'send_to_me',
  SEND_TO_NOTIFICATIONS_LIST = 'send_to_notifications_list',
  SEND_TO_OWNERS = 'send_to_owners',
}

const OPTIONS = [
  {
    value: SingleNotificationTarget.SEND_TO_ME,
    label: t('Send to me'),
  },
  {
    value: SingleNotificationTarget.SEND_TO_NOTIFICATIONS_LIST,
    label: t('Send to all from the notifications list'),
  },
  {
    value: SingleNotificationTarget.SEND_TO_OWNERS,
    label: t('Send to owners'),
  },
];

export const SingleReportSection = ({
  notificationSettings,
  currentAlert,
  contentType,
  reportFormat,
  isReport,
  forceScreenshot,
}: SingleReportSectionProps) => {
  const theme = useTheme();
  const currentUserEmail = useSelector<RootState, string | undefined>(
    state => state.user.email,
  );
  const [isReportInProgress, setIsReportInProgress] = useState(false);
  const { addInfoToast, addDangerToast, addSuccessToast } = useToasts();
  const [selectedRecipients, setSelectedRecipients] =
    useState<SingleNotificationTarget>(SingleNotificationTarget.SEND_TO_ME);
  const [tooltipTitle, setTooltipTitle] = useState<string | null>(null);
  const checkNotificationSettings = useCallback(() => {
    if (!notificationSettings.length) {
      return false;
    }

    let hasInfo = false;

    notificationSettings.forEach(setting => {
      if (!!setting.method && setting.recipients?.length) {
        hasInfo = true;
      }
    });

    return hasInfo;
  }, [notificationSettings]);

  const onSendSingleReport = () => {
    const recipients: Recipient[] = [];
    if (
      selectedRecipients === SingleNotificationTarget.SEND_TO_NOTIFICATIONS_LIST
    ) {
      notificationSettings.forEach(setting => {
        if (setting.method && setting.recipients.length) {
          recipients.push({
            recipient_config_json: {
              target: setting.recipients,
            },
            type: setting.method,
          });
        }
      });
    } else if (selectedRecipients === SingleNotificationTarget.SEND_TO_ME) {
      if (!currentUserEmail) {
        addDangerToast(t("Current user's email is not available"));
        return;
      }
      recipients.push({
        recipient_config_json: {
          target: currentUserEmail,
        },
        type: 'Email',
      });
    }
    const shouldEnableForceScreenshot = contentType === 'chart' && !isReport;
    const data: any = {
      type: isReport ? 'Report' : 'Alert',
      force_screenshot: shouldEnableForceScreenshot || forceScreenshot,
      chart: contentType === 'chart' ? currentAlert?.chart?.value : null,
      dashboard:
        contentType === 'dashboard' ? currentAlert?.dashboard?.value : null,
      owners: (currentAlert?.owners || []).map(
        owner => (owner as MetaObject).value || owner.id,
      ),
      recipients,
      report_format:
        contentType === 'dashboard'
          ? DEFAULT_NOTIFICATION_FORMAT
          : reportFormat || DEFAULT_NOTIFICATION_FORMAT,
      context_markdown: 'string',
      send_to_owners:
        selectedRecipients === SingleNotificationTarget.SEND_TO_OWNERS,
      ...pick(currentAlert, [
        'name',
        'description',
        'custom_width',
        'database',
        'extra',
      ]),
    };

    addInfoToast(t('Generating and sending report in progress'));
    setIsReportInProgress(true);
    SupersetClient.post({
      endpoint: `/api/v1/report/single_report`,
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    })
      .then(res => {
        if (res.response.status === 200) {
          addSuccessToast(
            t(
              'Report was successfully sent. Save report to make sure it will be scheduled',
            ),
          );
        } else {
          addDangerToast(t('Sending report failed. Please try again'));
        }
      })
      .catch(() => {
        addDangerToast(t('Sending report failed. Please try again'));
      })
      .finally(() => {
        setIsReportInProgress(false);
      });
  };

  const isDisabled =
    !currentAlert?.name ||
    (contentType === 'dashboard' && !isDefined(currentAlert?.dashboard)) ||
    (contentType === 'chart' && !isDefined(currentAlert?.chart)) ||
    (selectedRecipients === SingleNotificationTarget.SEND_TO_ME &&
      !currentUserEmail) ||
    (selectedRecipients ===
      SingleNotificationTarget.SEND_TO_NOTIFICATIONS_LIST &&
      !checkNotificationSettings()) ||
    (selectedRecipients === SingleNotificationTarget.SEND_TO_OWNERS &&
      !currentAlert.owners?.length);

  useEffect(() => {
    if (isReportInProgress) {
      setTooltipTitle(t('Generating and sending the report, please wait'));
    } else if (!currentAlert?.name) {
      setTooltipTitle(t('Report name is required'));
    } else if (
      (contentType === 'dashboard' && !isDefined(currentAlert?.dashboard)) ||
      (contentType === 'chart' && !isDefined(currentAlert?.chart))
    ) {
      setTooltipTitle(
        t('Select a dashboard or a chart to create and send a report'),
      );
    } else if (
      selectedRecipients === SingleNotificationTarget.SEND_TO_ME &&
      !currentUserEmail
    ) {
      setTooltipTitle(
        t(
          'Your email is required for the ‘Send to Me’ option, but it is not available',
        ),
      );
    } else if (
      selectedRecipients ===
        SingleNotificationTarget.SEND_TO_NOTIFICATIONS_LIST &&
      !checkNotificationSettings()
    ) {
      setTooltipTitle(
        t('Notification method setup is required for sending to recipients'),
      );
    } else if (
      selectedRecipients === SingleNotificationTarget.SEND_TO_OWNERS &&
      !currentAlert.owners?.length
    ) {
      setTooltipTitle(t('Owners must be assigned to send to owners'));
    } else {
      setTooltipTitle(null);
    }
  }, [
    checkNotificationSettings,
    contentType,
    currentAlert?.chart,
    currentAlert?.dashboard,
    currentAlert?.name,
    currentAlert?.owners?.length,
    currentUserEmail,
    isReportInProgress,
    selectedRecipients,
  ]);

  const SendButton = (
    <Button
      buttonStyle="secondary"
      onClick={isReportInProgress ? noOp : onSendSingleReport}
      disabled={isDisabled}
    >
      {isReportInProgress ? (
        <Icons.LoadingOutlined
          iconSize="m"
          css={css`
            && {
              margin-right: 0;
              line-height: 0;
            }
            & > * {
              line-height: 0;
            }
          `}
        />
      ) : (
        <Icons.SendOutlined
          iconSize="m"
          css={css`
            && {
              margin-right: 0;
              line-height: 0;
            }
            & > * {
              line-height: 0;
            }
          `}
        />
      )}
      {t('Send report now')}
    </Button>
  );

  return (
    <>
      <StyledSectionTitle>
        <h4>{t('Send report now')}</h4>
      </StyledSectionTitle>
      <Select
        options={OPTIONS}
        value={selectedRecipients}
        onSelect={selected =>
          setSelectedRecipients(selected as SingleNotificationTarget)
        }
        header={
          <div
            className="control-label"
            css={css`
              display: flex;
              align-items: center;
            `}
          >
            {t('Send to')}
            <span className="required">*</span>
            <Tooltip
              id="single-report-tooltip"
              title={t(
                'Choose the recipients for this report. You can send it to yourself for testing, all owners of the report, or to specific individuals listed in the notification settings who require immediate access to the report.',
              )}
              placement="top"
            >
              <Icons.InfoCircleOutlined
                iconSize="xs"
                iconColor={theme.colors.grayscale.base}
                css={css`
                  margin-left: ${theme.gridUnit}px;
                  & > * {
                    line-height: 0;
                  }
                `}
              />
            </Tooltip>
          </div>
        }
      />
      <div
        css={css`
          display: flex;
          justify-content: flex-end;
          margin-top: ${theme.gridUnit * 2}px;
        `}
      >
        {isDisabled ? (
          <Tooltip title={tooltipTitle}>
            {/* tooltip doesn't work on a disabled button unless we wrap it in a div */}
            <div>{SendButton}</div>
          </Tooltip>
        ) : (
          <Tooltip title={tooltipTitle}>{SendButton}</Tooltip>
        )}
      </div>
    </>
  );
};
