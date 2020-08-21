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
import { ButtonGroup, OverlayTrigger, Tooltip } from 'react-bootstrap';
import classnames from 'classnames';
import { t } from '@superset-ui/translation';
import styled from '@superset-ui/style';

import Button from '../../components/Button';
import Hotkeys from '../../components/Hotkeys';

const propTypes = {
  canAdd: PropTypes.bool.isRequired,
  onQuery: PropTypes.func.isRequired,
  onSave: PropTypes.func,
  onStop: PropTypes.func,
  loading: PropTypes.bool,
  chartIsStale: PropTypes.bool,
  errorMessage: PropTypes.node,
};

const defaultProps = {
  onStop: () => {},
  onSave: () => {},
  disabled: false,
};

// Prolly need to move this to a global context
const keymap = {
  RUN: 'ctrl + r, ctrl + enter',
  SAVE: 'ctrl + s',
};

const getHotKeys = () =>
  Object.keys(keymap).map(k => ({
    name: k,
    descr: keymap[k],
    key: k,
  }));

const Styles = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-bottom: ${({ theme }) => 2 * theme.gridUnit}px;

  .save-btn {
    width: 100px;
  }
`;

export default function QueryAndSaveBtns({
  canAdd,
  onQuery,
  onSave,
  onStop,
  loading,
  chartIsStale,
  errorMessage,
}) {
  const saveClasses = classnames({
    'disabled disabledButton': !canAdd,
    'save-btn': true,
  });

  let qryButtonStyle = 'default';
  if (errorMessage) {
    qryButtonStyle = 'danger';
  } else if (chartIsStale) {
    qryButtonStyle = 'primary';
  }

  const saveButtonDisabled = errorMessage ? true : loading;
  const qryOrStopButton = loading ? (
    <Button onClick={onStop} bsStyle="warning" className="save-btn">
      <i className="fa fa-stop-circle-o" /> Stop
    </Button>
  ) : (
    <Button
      className="query save-btn"
      onClick={onQuery}
      bsStyle={qryButtonStyle}
      disabled={!!errorMessage}
    >
      <i className="fa fa-bolt" /> {t('Run')}
    </Button>
  );

  return (
    <Styles>
      <div>
        <ButtonGroup className="query-and-save">
          {qryOrStopButton}
          <Button
            className={saveClasses}
            data-target="#save_modal"
            data-toggle="modal"
            disabled={saveButtonDisabled}
            onClick={onSave}
          >
            <i className="fa fa-plus-circle" /> Save
          </Button>
        </ButtonGroup>
        {errorMessage && (
          <span>
            {' '}
            <OverlayTrigger
              placement="right"
              overlay={
                <Tooltip id={'query-error-tooltip'}>{errorMessage}</Tooltip>
              }
            >
              <i className="fa fa-exclamation-circle text-danger fa-lg" />
            </OverlayTrigger>
          </span>
        )}
      </div>
      <div className="m-l-5 text-muted">
        <Hotkeys
          header="Keyboard shortcuts"
          hotkeys={getHotKeys()}
          placement="right"
        />
      </div>
    </Styles>
  );
}

QueryAndSaveBtns.propTypes = propTypes;
QueryAndSaveBtns.defaultProps = defaultProps;
