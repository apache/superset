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
import React from 'react';
import { styled, t, JsonObject } from '@superset-ui/core';

import { Menu, NoAnimationDropdown } from 'src/common/components';

const MENU_KEYS = {
  EMAIL_REPORTS_ACTIVE: 'email-reports-active',
  EDIT_REPORT: 'edit-report',
  DELETE_REPORT: 'delete-report',
};

export default function HeaderReportActionsDropDown({
  showReportModal,
  hideReportModal,
  report,
}: {
  showReportModal: () => void;
  hideReportModal: () => void;
  report: JsonObject;
}) {
  const menu = () => (
    <Menu selectable={false}>
      <Menu.Item>{t('Activate Report Toggle')}</Menu.Item>
    </Menu>
  );

  return (
    <NoAnimationDropdown
      overlay={menu}
      trigger={['click']}
      getPopupContainer={(triggerNode: any) =>
        triggerNode.closes('action-button') as HTMLElement
      }
    />
  );
}
