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
import React, { FunctionComponent } from 'react';
import { Row, Col } from 'src/components';
import { t, styled } from '@superset-ui/core';
import { FilterDropdown, FlashServiceObject } from 'src/views/CRUD/flash/types';
import Modal from 'src/components/Modal';
import withToasts, {
  ToastProps,
} from 'src/components/MessageToasts/withToasts';
import SyntaxHighlighterCopy from 'src/views/CRUD/data/components/SyntaxHighlighterCopy';
import {
  convertDateToReqFormat,
  convertValueToLabel,
} from 'src/utils/commonHelper';
import moment from 'moment';
import Button from 'src/components/Button';

interface FlashViewButtonProps extends ToastProps {
  flash: FlashServiceObject;
  show: boolean;
  onHide: () => void;
  databaseDropdown: FilterDropdown[];
}

const StyledModal = styled(Modal)`
  .ant-modal-body {
    padding: 24px;
  }

  pre {
    font-size: ${({ theme }) => theme.typography.sizes.xs}px;
    font-weight: ${({ theme }) => theme.typography.weights.normal};
    line-height: ${({ theme }) => theme.typography.sizes.l}px;
    height: 200px;
    border: none;
  }
`;

const Label = styled.span`
  color: ${({ theme }) => theme.colors.secondary.light2};
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  margin-bottom: 10px;
  text-transform: uppercase;
`;

const Value = styled.span`
  color: ${({ theme }) => theme.colors.grayscale.dark2};
  font-size: ${({ theme }) => theme.typography.sizes.m}px;
  margin-bottom: 10px;
`;

const StyledCol = styled(Col)`
  margin-bottom: 15px;
`;

const FlashView: FunctionComponent<FlashViewButtonProps> = ({
  flash,
  onHide,
  show,
  databaseDropdown,
  addDangerToast,
  addSuccessToast,
}) => {
  const appContainer = document.getElementById('app');
  const bootstrapData = JSON.parse(
    appContainer?.getAttribute('data-bootstrap') || '{}',
  );
  const flashUrl = bootstrapData?.common?.conf?.FLASH_URL;

  const openAuditLogs = () => {
    const url = `${flashUrl}v1/flash/${flash?.id}/audit-log`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const renderModalBody = () => (
    <>
      <Row>
        <StyledCol xs={5}>
          <Label>Flash Name:</Label>
        </StyledCol>
        <StyledCol xs={12}>
          <Value>{flash?.tableName}</Value>
        </StyledCol>
      </Row>

      <Row>
        <StyledCol xs={5}>
          <Label>Owner:</Label>
        </StyledCol>
        <StyledCol xs={12}>
          <Value>{flash?.owner}</Value>
        </StyledCol>
      </Row>
      <Row>
        <StyledCol xs={5}>
          <Label>Flash Type:</Label>
        </StyledCol>
        <StyledCol xs={7}>
          <Value>
            {flash?.flashType
              ? flash.flashType.replace(/([A-Z])/g, ' $1').trim()
              : ''}
          </Value>
        </StyledCol>
        <StyledCol xs={5}>
          <Label>Database Name:</Label>
        </StyledCol>
        <StyledCol xs={7}>
          <Value>
            {flash?.datastoreId
              ? convertValueToLabel(flash.datastoreId, databaseDropdown)
              : 'NIL'}
          </Value>
        </StyledCol>
        <StyledCol xs={5}>
          <Label>TTL:</Label>
        </StyledCol>
        <StyledCol xs={7}>
          <Value>{flash?.ttl}</Value>
        </StyledCol>
        <StyledCol xs={5}>
          <Label>Schedule Type:</Label>
        </StyledCol>
        <StyledCol xs={7}>
          <Value>{flash?.scheduleType ? flash?.scheduleType : 'NIL'}</Value>
        </StyledCol>
        <StyledCol xs={5}>
          <Label>Schedule Start Time:</Label>
        </StyledCol>
        <StyledCol xs={7}>
          <Value>
            {flash?.scheduleStartTime
              ? convertDateToReqFormat(flash?.scheduleStartTime)
              : 'NIL'}
          </Value>
        </StyledCol>
        <StyledCol xs={5}>
          <Label>Slack Channel:</Label>
        </StyledCol>
        <StyledCol xs={7}>
          <Value>
            {flash?.teamSlackChannel ? flash?.teamSlackChannel : 'NIL'}
          </Value>
        </StyledCol>
        <StyledCol xs={5}>
          <Label>Slack Handle:</Label>
        </StyledCol>
        <StyledCol xs={7}>
          <Value>
            {flash?.teamSlackHandle ? flash?.teamSlackHandle : 'NIL'}
          </Value>
        </StyledCol>
        <StyledCol xs={5}>
          <Label>Status:</Label>
        </StyledCol>
        <StyledCol xs={7}>
          <Value>{flash?.status}</Value>
        </StyledCol>
        <StyledCol xs={5}>
          <Label>Created At:</Label>
        </StyledCol>
        <StyledCol xs={7}>
          <Value>
            {flash?.createdAt
              ? moment(flash?.createdAt).format('DD/MM/YYYY hh:mm:ss A')
              : 'NIL'}
          </Value>
        </StyledCol>
        <StyledCol xs={5}>
          <Label>Updated At:</Label>
        </StyledCol>
        <StyledCol xs={7}>
          <Value>
            {flash?.updatedAt
              ? convertDateToReqFormat(flash?.updatedAt)
              : 'NIL'}
          </Value>
        </StyledCol>
        <StyledCol xs={5}>
          <Label>Last Refresh Time:</Label>
        </StyledCol>
        <StyledCol xs={7}>
          <Value>
            {flash?.lastRefreshTime
              ? moment(flash?.lastRefreshTime).format('DD/MM/YYYY hh:mm:ss A')
              : 'NIL'}
          </Value>
        </StyledCol>
      </Row>
      <Row css={{ justifyContent: 'flex-end' }}>
        <Button onClick={() => openAuditLogs()}>Audit Logs</Button>
      </Row>
      <Label>SQL Query:</Label>
      <SyntaxHighlighterCopy
        language="sql"
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
      >
        {flash?.sqlQuery}
      </SyntaxHighlighterCopy>
    </>
  );

  return (
    <div role="none">
      <StyledModal
        onHide={onHide}
        draggable
        show={show}
        title={t('Flash Information')}
        footer={<></>}
      >
        {renderModalBody()}
      </StyledModal>
    </div>
  );
};

export default withToasts(FlashView);
