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
import { useSelector } from 'react-redux';
import { t } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { Switch } from 'src/components/Switch';
import { AlertObject } from 'src/views/CRUD/alert/types';
import { Menu, NoAnimationDropdown } from 'src/common/components';
// function useOnClickOutside(ref: any, handler: any) {
//   useEffect(() => {
//     const listener = (event: any) => {
//       if (ref.current || ref.current.contains(event.target)) {
//         handler(event);
//       }
//     };
//     document.addEventListener('mousedown', listener, { capture: true });
//     document.addEventListener('touchstart', listener, { capture: true });
//     return () => {
//       document.removeEventListener('mousedown', listener, { capture: true });
//       document.removeEventListener('touchstart', listener, { capture: true });
//     };
//   }, [ref, handler]);
// }

export default function HeaderReportActionsDropDown({
  // showReportModal,
  // hideReportModal,
  // addDangerToast,
  toggleActive,
}: {
  showReportModal: () => void;
  hideReportModal: () => void;
  // addDangerToast: () => void;
  toggleActive: (data: AlertObject, checked: boolean) => void;
}) {
  // const ref: any = useRef();
  const report = useSelector<any, AlertObject>(
    state => state.reportState.report.result[0],
  );

  const toggleActiveKey = async (data: AlertObject, checked: boolean) => {
    if (data?.id) {
      toggleActive(data, checked);
    }
  };

  const menu = () => (
    <Menu selectable={false}>
      <Menu.Item>
        {t('Email reports active')}
        <Switch
          data-test="toggle-active"
          checked={report.active}
          onClick={(checked: boolean) => toggleActiveKey(report, checked)}
          size="small"
        />
      </Menu.Item>
      <Menu.Item>
        <div role="button" tabIndex={0}>
          {' '}
          {t('Edit email report')}
        </div>
      </Menu.Item>
      <Menu.Item>{t('Delete email report')}</Menu.Item>
    </Menu>
  );

  return (
    <NoAnimationDropdown
      // ref={ref}
      overlay={menu()}
      trigger={['click']}
      getPopupContainer={(triggerNode: any) =>
        triggerNode.closest('.action-button')
      }
    >
      <span role="button" className="action-button" tabIndex={0}>
        <Icons.Calendar />
      </span>
    </NoAnimationDropdown>
  );
}
