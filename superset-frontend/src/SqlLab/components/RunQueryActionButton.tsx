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
import { t } from '@superset-ui/core';

import Button, { ButtonProps } from 'src/components/Button';
import { Dropdown, Menu } from 'src/common/components';
import Icon from 'src/components/Icon';

const NO_OP = () => undefined;

interface Props {
  allowAsync: boolean;
  dbId?: number;
  queryState?: string;
  runQuery: (c?: boolean) => void;
  selectedText?: string;
  stopQuery: () => void;
  sql: string;
  overlayCreateAsMenu: typeof Menu;
  createTableAs:
  createViewAs:
  allowCTAS:
  allowCVAS:
}

const RunQueryActionButton = ({
  allowAsync = false,
  dbId,
  queryState,
  runQuery = NO_OP,
  selectedText,
  stopQuery = NO_OP,
  sql = '',
  overlayCreateAsMenu,
}: Props) => {
  const runBtnText = selectedText ? t('Run Selection') : t('Run');
  const btnStyle = selectedText ? 'warning' : 'primary';
  const shouldShowStopBtn =
    !!queryState && ['running', 'pending'].indexOf(queryState) > -1;

  if (shouldShowStopBtn) {
    return (
      <Dropdown.Button
        onClick={stopQuery}
        icon={<Icon color="#00000" name="caret-down" />}
        type={btnStyle}
        overlay={overlayCreateAsMenu}
        disabled={!sql.trim()}
      >
        <i className="fa fa-stop" /> {t('Stop')}
      </Dropdown.Button>
    );
  }
  if (allowAsync) {
    return (
      <Dropdown.Button
        onClick={() => runQuery(true)}
        icon={<Icon color="#00000" name="caret-down" />}
        type={btnStyle}
        overlay={overlayCreateAsMenu}
        disabled={!sql.trim()}
      >
        <i className="fa fa-bolt" /> {runBtnText}
      </Dropdown.Button>
    );
  }
  return (
    <Dropdown.Button
      onClick={() => runQuery(false)}
      icon={<Icon color="#00000" name="caret-down" />}
      type={btnStyle}
      overlay={overlayCreateAsMenu}
      disabled={!sql.trim()}
    >
      <i className="fa fa-refresh" /> {runBtnText}
    </Dropdown.Button>
  );
};

export default RunQueryActionButton;
