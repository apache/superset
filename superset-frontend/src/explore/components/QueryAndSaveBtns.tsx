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
import ButtonGroup from 'src/components/ButtonGroup';
import { t, useTheme } from '@superset-ui/core';

import { Tooltip } from 'src/components/Tooltip';
import Button, { ButtonStyle, OnClickHandler } from 'src/components/Button';

export type QueryAndSaveBtnsProps = {
  canAdd: boolean;
  onQuery: OnClickHandler;
  onSave: OnClickHandler;
  onStop: OnClickHandler;
  loading?: boolean;
  chartIsStale?: boolean;
  errorMessage: React.ReactElement | undefined;
};

export default function QueryAndSaveBtns(props: QueryAndSaveBtnsProps) {
  const {
    canAdd,
    onQuery = () => {},
    onSave = () => {},
    onStop = () => {},
    loading,
    chartIsStale,
    errorMessage,
  } = props;
  let qryButtonStyle: ButtonStyle = 'tertiary';
  if (errorMessage) {
    qryButtonStyle = 'danger';
  } else if (chartIsStale) {
    qryButtonStyle = 'primary';
  }

  const saveButtonDisabled = errorMessage ? true : loading;
  const qryOrStopButton = loading ? (
    <Button
      onClick={onStop}
      buttonStyle="warning"
      buttonSize="small"
      disabled={!canAdd}
    >
      <i className="fa fa-stop-circle-o" /> {t('Stop')}
    </Button>
  ) : (
    <Button
      buttonSize="small"
      onClick={onQuery}
      buttonStyle={qryButtonStyle}
      disabled={!!errorMessage}
      data-test="run-query-button"
    >
      <i className="fa fa-bolt" /> {t('Run')}
    </Button>
  );

  const theme = useTheme();

  return (
    <div
      css={{
        display: 'flex',
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: theme.gridUnit * 2,
        paddingRight: theme.gridUnit * 2,
        paddingBottom: 0,
        paddingLeft: theme.gridUnit * 4,
        '& button': {
          width: 100,
        },
        '.errMsg': {
          marginLeft: theme.gridUnit * 4,
        },
      }}
    >
      <ButtonGroup className="query-and-save">
        {qryOrStopButton}
        <Button
          buttonStyle="tertiary"
          buttonSize="small"
          data-target="#save_modal"
          data-toggle="modal"
          disabled={saveButtonDisabled}
          onClick={onSave}
          data-test="query-save-button"
        >
          <i className="fa fa-plus-circle" /> {t('Save')}
        </Button>
      </ButtonGroup>
      {errorMessage && (
        <span className="errMsg">
          {' '}
          <Tooltip
            id="query-error-tooltip"
            placement="right"
            title={errorMessage}
          >
            <i className="fa fa-exclamation-circle text-danger fa-lg" />
          </Tooltip>
        </span>
      )}
    </div>
  );
}
