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
import { useSelector } from 'react-redux';
import { css, styled, t } from '@superset-ui/core';

import Alert from 'src/components/Alert';
import TableView from 'src/components/TableView';
import Button from 'src/components/Button';
import Loading from 'src/components/Loading';
import ModalTrigger from 'src/components/ModalTrigger';
import { EmptyWrapperType } from 'src/components/TableView/TableView';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import { SqlLabRootState, QueryCostEstimate } from 'src/SqlLab/types';

export interface EstimateQueryCostButtonProps {
  getEstimate: Function;
  queryEditorId: string;
  tooltip?: string;
  disabled?: boolean;
}

const CostEstimateModalStyles = styled.div`
  ${({ theme }) => css`
    font-size: ${theme.typography.sizes.s};
  `}
`;

const EstimateQueryCostButton = ({
  getEstimate,
  queryEditorId,
  tooltip = '',
  disabled = false,
}: EstimateQueryCostButtonProps) => {
  const queryCostEstimate = useSelector<
    SqlLabRootState,
    QueryCostEstimate | undefined
  >(state => state.sqlLab.queryCostEstimates?.[queryEditorId]);

  const { selectedText } = useQueryEditor(queryEditorId, ['selectedText']);
  const { cost } = queryCostEstimate || {};
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
    if (queryCostEstimate?.error) {
      return (
        <Alert
          key="query-estimate-error"
          type="error"
          message={queryCostEstimate?.error}
        />
      );
    }
    if (queryCostEstimate?.completed) {
      return (
        <CostEstimateModalStyles>
          <TableView
            columns={columns}
            data={tableData}
            withPagination={false}
            emptyWrapperType={EmptyWrapperType.Small}
          />
        </CostEstimateModalStyles>
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
