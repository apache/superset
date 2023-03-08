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
import Modal from 'src/components/Modal';
import withToasts, {
  ToastProps,
} from 'src/components/MessageToasts/withToasts';
import SyntaxHighlighterCopy from 'src/views/CRUD/data/components/SyntaxHighlighterCopy';
import { FlashAuditLogs } from '../../types';

interface ErrorStackTraceProps extends ToastProps {
  log: FlashAuditLogs;
  show: boolean;
  onHide: () => void;
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

const ErrorStackTrace: FunctionComponent<ErrorStackTraceProps> = ({
  log,
  onHide,
  show,
  addDangerToast,
  addSuccessToast,
}) => {
  const renderModalBody = () => (
    <>
      <Row>
        <Label>Error:</Label>
        <SyntaxHighlighterCopy
          language="plaintext"
          addDangerToast={addDangerToast}
          addSuccessToast={addSuccessToast}
          wrapLongLines
        >
          {log?.description || ''}
        </SyntaxHighlighterCopy>
      </Row>
    </>
  );

  return (
    <div role="none">
      <StyledModal
        onHide={onHide}
        draggable
        show={show}
        title={t('Error Stack Trace')}
        footer={<></>}
      >
        {renderModalBody()}
      </StyledModal>
    </div>
  );
};

export default withToasts(ErrorStackTrace);
