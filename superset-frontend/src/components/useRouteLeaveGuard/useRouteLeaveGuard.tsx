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

import React, { useCallback, useEffect, useRef } from 'react';
import type { Action, Location, History } from 'history';
import { useHistory } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { t } from '@superset-ui/core';
import { AntdModal } from 'src/components';
import Icons from 'src/components/Icons';
import { setSaveModalVisible } from 'src/explore/actions/saveModalActions';

const handleNavigationAction = (
  history: History,
  location: Location,
  action: Action,
) => {
  switch (action) {
    case 'REPLACE': {
      history.replace(location);
      return;
    }
    case 'PUSH':
    default: {
      history.push(location);
    }
  }
};

export const useRouteLeaveGuard = (
  allowNavigation: (location: Location, action: Action) => string | boolean,
  when: boolean,
) => {
  const isBeforeUnloadActive = useRef(false);
  const history = useHistory();
  const dispatch = useDispatch();

  const handleUnloadEvent = useCallback((e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = 'Controls changed';
  }, []);

  // true is a valid return value, but react-router types expect only
  // false, string or void - probably a bug
  // @ts-ignore
  const unblock = history.block((nextLocation, action) => {
    // we cannot block the browser "Back" button
    if (allowNavigation(nextLocation, action) || action === 'POP') {
      unblock();
      return true;
    }
    AntdModal.confirm({
      onOk: () => {
        dispatch(setSaveModalVisible(true));
      },
      onCancel: () => {
        unblock();
        handleNavigationAction(history, nextLocation, action);
      },
      title: t('Save changes to your chart?'),
      icon: <Icons.WarningOutlined />,
      content: t('If you don’t save, changes will be lost.'),
      okText: t('Save'),
      cancelText: t('Discard'),
    });
    return false;
  });

  useEffect(() => {
    if (when && !isBeforeUnloadActive.current) {
      window.addEventListener('beforeunload', handleUnloadEvent);
      isBeforeUnloadActive.current = true;
    }
    if (!when && isBeforeUnloadActive.current) {
      window.removeEventListener('beforeunload', handleUnloadEvent);
      isBeforeUnloadActive.current = false;
    }
  }, [handleUnloadEvent, when]);

  // cleanup beforeunload event listener
  // we use separate useEffect to call it only on component unmount instead of on every form data change
  useEffect(
    () => () => {
      window.removeEventListener('beforeunload', handleUnloadEvent);
    },
    [handleUnloadEvent],
  );
};
