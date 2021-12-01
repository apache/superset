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
import Alert from 'src/components/Alert';
import { t } from '@superset-ui/core';
import TableView from 'src/components/TableView';
import Button from 'src/components/Button';
import Loading from 'src/components/Loading';
import ModalTrigger from 'src/components/ModalTrigger';
import { EmptyWrapperType } from 'src/components/TableView/TableView';

interface EstimateQueryCostButtonProps {
  dbId: number;
  schema: string;
  sql: string;
  getEstimate: Function;
  queryCostEstimate: Record<string, any>;
  selectedText?: string;
  tooltip?: string;
  disabled?: boolean;
}

const EstimateQueryCostButton = ({
  dbId,
  schema,
  sql,
  getEstimate,
  queryCostEstimate = {},
  selectedText,
  tooltip = '',
  disabled = false,
}: EstimateQueryCostButtonProps) => {
  const { cost } = queryCostEstimate;
  const tableData = useMemo(() => (Array.isArray(cost) ? cost : []), [cost]);
  const columns = useMemo(
    () =>
      Array.isArray(cost) && cost.length
        ? Object.keys(cost[0]).map(key => ({ accessor: key, Header: key }))
        : [],
    [cost],
  );

  // A call back method to pass an event handler function as a prop to the Button element.
  // Refer: https://reactjs.org/docs/handling-events.html
  const onClickHandler = () => {
    getEstimate();
  };

  const renderModalBody = () => {
    if (queryCostEstimate.error !== null) {
      return (
        <Alert
          key="query-estimate-error"
          type="error"
          message={queryCostEstimate.error}
        />
      );
    }
    if (queryCostEstimate.completed) {
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

  const btnText = selectedText
    ? t('Estimate selected query cost')
    : t('Estimate cost');
  return (
    <span className="EstimateQueryCostButton">
      <ModalTrigger
        modalTitle={t('Cost estimate')}
        modalBody={renderModalBody()}
        triggerNode={
          <Button
            style={{ height: 32, padding: '4px 15px' }}
            onClick={onClickHandler}
            key="query-estimate-btn"
            tooltip={tooltip}
            disabled={disabled}
          >
            {btnText}
          </Button>
        }
      />
    </span>
  );
};

export default EstimateQueryCostButton;
