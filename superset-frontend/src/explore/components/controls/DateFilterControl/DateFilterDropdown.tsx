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
import { t, TimeRangeEndpoints } from '@superset-ui/core';
import {
  Dropdown,
  Menu,
} from 'src/common/components';
import Label from 'src/components/Label';

import {
  // buildTimeRangeString,
  formatTimeRange,
} from 'src/explore/dateFilterUtils';
import ControlHeader from 'src/explore/components/ControlHeader';
import DateRangeModal from "./DateRangeModal";

const COMMON_TIME_FRAMES = [
  'Last day',
  'Last week',
  'Last month',
  'Last quarter',
  'Last year',
];
const PREVIOUS_CALENDAR_FRAMES = [
  'Previsous Calendar day',
  'Previsous Calendar week',
  'Previsous Calendar month',
  'Previsous Calendar year',
];

const { SubMenu } = Menu;

interface DateFilterDropdownProps {
  animation?: boolean;
  name: string;
  label?: string;
  description?: string;
  onChange?: () => {};
  value?: string;
  height?: number;
  onOpenDateFilterControl?: () => {};
  onCloseDateFilterControl?: () => {};
  endpoints?: TimeRangeEndpoints;
}

export default function DateFilterDropdown(props: DateFilterDropdownProps) {
  const { value = 'Last week', endpoints } = props;
  const [showRangeModal, setRangeModal] = useState<boolean>(false);
  // const [showAdvancedModal, setAdvancedModal] = useState<boolean>(false);

  function renderMenu() {
    const lastSubMenu = COMMON_TIME_FRAMES.map(timeFrame => (
      <Menu.Item key={timeFrame}>{timeFrame}</Menu.Item>
    ));
    const previousSubMenu = PREVIOUS_CALENDAR_FRAMES.map(timeFrame => (
      <Menu.Item key={timeFrame}>{timeFrame}</Menu.Item>
    ));

    return (
      <Menu>
        <SubMenu key="last" title={t('Last')}>
          {lastSubMenu}
        </SubMenu>
        <SubMenu key="previous" title={t('Previous')}>
          {previousSubMenu}
        </SubMenu>
        <Menu.Item key="range" onClick={() => setRangeModal(true)}>
          {t('Range...')}
        </Menu.Item>
        <Menu.Item key="advanced">{t('Advanced...')}</Menu.Item>
        <Menu.Item key="nofilter">{t('No Filter')}</Menu.Item>
      </Menu>
    );
  }

  return (
    <>
      <ControlHeader {...props} />
      <Label style={{ textTransform: 'none' }}>
        {formatTimeRange(value, endpoints)}
        <Dropdown
          overlay={renderMenu()}
          trigger={['click']}
          data-test="datasource-menu"
        >
          <i
            className="angle fa fa-angle-down"
            style={{ marginLeft: '10px' }}
          />
        </Dropdown>
      </Label>
      <DateRangeModal {...props} show={showRangeModal} onHide={() => setRangeModal(false)} />
    </>
  );
}
