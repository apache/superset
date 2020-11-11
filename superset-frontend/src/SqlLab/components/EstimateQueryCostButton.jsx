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
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Alert } from 'react-bootstrap';
import { t } from '@superset-ui/core';

import TableView from 'src/components/TableView';
import Button from 'src/components/Button';
import Loading from '../../components/Loading';
import ModalTrigger from '../../components/ModalTrigger';
import { EmptyWrapperType } from '../../components/TableView/TableView';

const propTypes = {
  dbId: PropTypes.number.isRequired,
  schema: PropTypes.string.isRequired,
  sql: PropTypes.string.isRequired,
  getEstimate: PropTypes.func.isRequired,
  queryCostEstimate: PropTypes.Object,
  selectedText: PropTypes.string,
  tooltip: PropTypes.string,
  disabled: PropTypes.bool,
};
const defaultProps = {
  queryCostEstimate: [],
  tooltip: '',
  disabled: false,
};

const EstimateQueryCostButton = props => {
  const { cost } = props.queryCostEstimate;
  const tableData = useMemo(() => (Array.isArray(cost) ? cost : []), [cost]);
  const columns = useMemo(
    () =>
      Array.isArray(cost) && cost.length
        ? Object.keys(cost[0]).map(key => ({ accessor: key, Header: key }))
        : [],
    [cost],
  );

  const onClick = () => {
    props.getEstimate();
  };

  const renderModalBody = () => {
    if (props.queryCostEstimate.error !== null) {
      return (
        <Alert key="query-estimate-error" bsStyle="danger">
          {props.queryCostEstimate.error}
        </Alert>
      );
    }
    if (props.queryCostEstimate.completed) {
      return (
        <TableView
          columns={columns}
          data={tableData}
          withPagination={false}
          emptyWrapperType={EmptyWrapperType.Small}
          className="cost-estimate"
        />
      );
    }
    return <Loading position="normal" />;
  };

  const { disabled, selectedText, tooltip } = props;
  const btnText = selectedText
    ? t('Estimate Selected Query Cost')
    : t('Estimate Query Cost');
  return (
    <span className="EstimateQueryCostButton">
      <ModalTrigger
        modalTitle={t('Query Cost Estimate')}
        modalBody={renderModalBody()}
        triggerNode={
          <Button
            buttonStyle="warning"
            buttonSize="small"
            onClick={onClick}
            key="query-estimate-btn"
            tooltip={tooltip}
            disabled={disabled}
          >
            <i className="fa fa-clock-o" /> {btnText}
          </Button>
        }
      />
    </span>
  );
};

EstimateQueryCostButton.propTypes = propTypes;
EstimateQueryCostButton.defaultProps = defaultProps;

export default EstimateQueryCostButton;
