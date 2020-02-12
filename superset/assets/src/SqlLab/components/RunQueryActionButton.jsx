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
import PropTypes from 'prop-types';
import { t } from '@superset-ui/translation';

import Button from '../../components/Button';

const propTypes = {
  allowAsync: PropTypes.bool.isRequired,
  dbId: PropTypes.number,
  queryState: PropTypes.string,
  runQuery: PropTypes.func.isRequired,
  selectedText: PropTypes.string,
  stopQuery: PropTypes.func.isRequired,
  sql: PropTypes.string.isRequired,
};
const defaultProps = {
  allowAsync: false,
  sql: '',
};

export default function RunQueryActionButton(props) {
  const runBtnText = props.selectedText ? t('Run Selected Query') : t('Run Query');
  const btnStyle = props.selectedText ? 'warning' : 'primary';
  const shouldShowStopBtn = ['running', 'pending'].indexOf(props.queryState) > -1;

  const commonBtnProps = {
    bsSize: 'small',
    bsStyle: btnStyle,
    disabled: !(props.dbId),
  };

  if (shouldShowStopBtn) {
    return (
      <Button
        {...commonBtnProps}
        onClick={props.stopQuery}
      >
        <i className="fa fa-stop" /> {t('Stop')}
      </Button>
    );
  } else if (props.allowAsync) {
    return (
      <Button
        {...commonBtnProps}
        onClick={() => props.runQuery(true)}
        key="run-async-btn"
        tooltip={t('Run query asynchronously (Ctrl + ↵)')}
        disabled={!props.sql.trim()}
      >
        <i className="fa fa-table" /> {runBtnText}
      </Button>);
  }
  return (
    <Button
      {...commonBtnProps}
      onClick={() => props.runQuery(false)}
      key="run-btn"
      tooltip={t('Run query synchronously (Ctrl + ↵)')}
      disabled={!props.sql.trim()}
    >
      <i className="fa fa-refresh" /> {runBtnText}
    </Button>
  );
}

RunQueryActionButton.propTypes = propTypes;
RunQueryActionButton.defaultProps = defaultProps;
