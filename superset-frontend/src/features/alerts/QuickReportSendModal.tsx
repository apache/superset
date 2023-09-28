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

import React, { useEffect, useState } from 'react';
import { css, ensureIsArray, SupersetClient, t } from '@superset-ui/core';
import { useSelector } from 'react-redux';
import pick from 'lodash/pick';
import Modal from 'src/components/Modal';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { RootState } from 'src/dashboard/types';
import { Select } from 'src/components';
import { useSingleViewResource } from 'src/views/CRUD/hooks';
import Loading from 'src/components/Loading';
import { AlertObject, MetaObject, Recipient } from './types';

export interface QuickReportSendModalProps {
  onHide: () => void;
  alertId: number;
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

export const QuickReportSendModal = ({
  onHide,
  alertId,
}: QuickReportSendModalProps) => {
  const { addInfoToast, addDangerToast, addSuccessToast } = useToasts();
  const [selectedRecipients, setSelectedRecipients] =
    useState<SingleNotificationTarget>(SingleNotificationTarget.SEND_TO_ME);
  const {
    state: { loading, resource },
    fetchResource,
    clearError,
  } = useSingleViewResource<AlertObject>('report', t('report'), addDangerToast);

  useEffect(() => {
    fetchResource(alertId);
  }, [alertId, fetchResource]);

  const hide = () => {
    onHide();
    clearError();
  };

  const currentUserEmail = useSelector<RootState, string | undefined>(
    state => state.user.email,
  );
  const onSendSingleReport = () => {
    if (!resource) {
      return;
    }
    const recipients: Recipient[] = [];

    if (
      selectedRecipients === SingleNotificationTarget.SEND_TO_NOTIFICATIONS_LIST
    ) {
      recipients.push(
        ...ensureIsArray(resource.recipients).map(setting => ({
          type: setting.type,
          // @ts-ignore: Type not assignable
          recipient_config_json:
            typeof setting.recipient_config_json === 'string'
              ? JSON.parse(setting.recipient_config_json)
              : {},
        })),
      );
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

    const data: any = {
      chart: resource.chart?.id ?? null,
      dashboard: resource.dashboard?.id ?? null,
      owners: (resource.owners || []).map(
        owner => (owner as MetaObject).value || owner.id,
      ),
      send_to_owners:
        selectedRecipients === SingleNotificationTarget.SEND_TO_OWNERS,
      recipients,
      ...pick(resource, [
        'type',
        'force_screenshot',
        'context_markdown',
        'name',
        'report_format',
        'description',
        'custom_width',
        'extra',
      ]),
    };

    addInfoToast(t('Generating and sending report in progress'));
    SupersetClient.post({
      endpoint: `/api/v1/report/single_report`,
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    })
      .then(res => {
        if (res.response.status === 200) {
          addSuccessToast(t('Report was successfully sent'));
        } else {
          addDangerToast(t('Sending report failed. Please try again'));
        }
      })
      .catch(() => {
        addDangerToast(t('Sending report failed. Please try again'));
      });
  };

  const handlePrimaryButton = () => {
    onSendSingleReport();
    onHide();
  };

  return loading ? (
    <Loading />
  ) : (
    <Modal
      title={t('Send report now')}
      onHide={hide}
      primaryButtonName={t('Send now')}
      onHandledPrimaryAction={handlePrimaryButton}
      show
      responsive
      centered
      maxWidth="600px"
      destroyOnClose
    >
      <p>
        {t(
          'You can send %s right now without scheduling it. This action is one-time only. You can choose to send it to yourself, all owners of the report, or all of the users listed in the notification method who need immediate access.',
          resource?.name,
        )}
      </p>
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
          </div>
        }
      />
    </Modal>
  );
};
