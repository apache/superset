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
import React, { useState } from 'react';
import { JsonObject, styled, t } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { Switch } from 'src/components/Switch';
import { AlertObject } from 'src/views/CRUD/alert/types';
import { useSingleViewResource } from 'src/views/CRUD/hooks';
import { Menu, NoAnimationDropdown } from 'src/common/components';

export default function HeaderReportActionsDropDown({
  showReportModal,
  hideReportModal,
  report,
  addDangerToast,
}: {
  showReportModal: () => void;
  hideReportModal: () => void;
  report: JsonObject;
  addDangerToast: () => void;
}) {
  const { result } = report;
  const [active, setActive] = useState<boolean | undefined>(result[0].active);
  const [visible, setVisible] = useState<boolean>(true);
  const { updateResource } = useSingleViewResource<Partial<AlertObject>>(
    'report',
    t('reports'),
    addDangerToast,
  );

  const toggleActive = async (data: AlertObject, checked: boolean) => {
    if (data && data.id) {
      const update_id = data.id;
      await updateResource(update_id, { active: checked }).then(() => {
        setActive(checked);
      });
    }
  };

  const menu = () => (
    <Menu selectable={false} onBlur={() => setVisible(!visible)}>
      <Menu.Item>
        {t('Email reports active')}
        <Switch
          data-test="toggle-active"
          checked={active}
          onClick={(checked: boolean) => toggleActive(result[0], checked)}
          size="small"
        />
      </Menu.Item>
      <Menu.Item>{t('Edit email report')}</Menu.Item>
      <Menu.Item>{t('Delete email report')}</Menu.Item>
    </Menu>
  );

  return (
    <NoAnimationDropdown
      overlay={menu()}
      trigger={['click']}
      visible={visible}
      getPopupContainer={(triggerNode: any) =>
        triggerNode.closest('.action-button')
      }
    >
      <span
        role="button"
        className="action-button"
        tabIndex={0}
        onClick={() => setVisible(!visible)}
      >
        <Icons.Calendar />
      </span>
    </NoAnimationDropdown>
  );
}
