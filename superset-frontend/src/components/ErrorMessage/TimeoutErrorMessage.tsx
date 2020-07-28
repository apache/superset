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
import React, { useState } from 'react';
import { Modal } from 'react-bootstrap';
import { styled, supersetTheme } from '@superset-ui/style';
import { t, tn } from '@superset-ui/translation';

import { noOp } from 'src/utils/common';
import Button from 'src/views/CRUD/dataset/Button';
import Icon from '../Icon';
import { ErrorMessageComponentProps } from './types';
import CopyToClipboard from '../CopyToClipboard';
import IssueCode from './IssueCode';

const ErrorAlert = styled.div`
  align-items: center;
  background-color: ${({ theme }) => theme.colors.error.light2};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: 1px solid ${({ theme }) => theme.colors.error.base};
  color: ${({ theme }) => theme.colors.error.dark2};
  padding: ${({ theme }) => 2 * theme.gridUnit}px;
  width: 100%;

  .top-row {
    display: flex;
    justify-content: space-between;
  }

  .error-body {
    padding-top: ${({ theme }) => theme.gridUnit}px;
    padding-left: ${({ theme }) => 8 * theme.gridUnit}px;
  }

  .icon {
    margin-right: ${({ theme }) => 2 * theme.gridUnit}px;
  }

  .link {
    color: ${({ theme }) => theme.colors.error.dark2};
    text-decoration: underline;
  }
`;

const ErrorModal = styled(Modal)`
  color: ${({ theme }) => theme.colors.error.dark2};

  .icon {
    margin-right: ${({ theme }) => 2 * theme.gridUnit}px;
  }

  .header {
    align-items: center;
    background-color: ${({ theme }) => theme.colors.error.light2};
    display: flex;
    justify-content: space-between;
    font-size: ${({ theme }) => theme.typography.sizes.l}px;

    // Remove clearfix hack as Superset is only used on modern browsers
    ::before,
    ::after {
      content: unset;
    }
  }
`;

const LeftSideContent = styled.div`
  align-items: center;
  display: flex;
`;

interface TimeoutErrorExtra {
  issue_codes: {
    code: number;
    message: string;
  }[];
  owners?: string[];
  timeout: number;
}

function TimeoutErrorMessage({
  error,
  source,
}: ErrorMessageComponentProps<TimeoutErrorExtra>) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMessageExpanded, setIsMessageExpanded] = useState(false);
  const { extra } = error;

  const isVisualization = (['dashboard', 'explore'] as (
    | string
    | undefined
  )[]).includes(source);

  const isExpandable = (['explore', 'sqllab'] as (
    | string
    | undefined
  )[]).includes(source);

  const title = isVisualization
    ? tn(
        'We’re having trouble loading this visualization. Queries are set to timeout after %s second.',
        'We’re having trouble loading this visualization. Queries are set to timeout after %s seconds.',
        extra.timeout,
        extra.timeout,
      )
    : tn(
        'We’re having trouble loading these results. Queries are set to timeout after %s second.',
        'We’re having trouble loading these results. Queries are set to timeout after %s seconds.',
        extra.timeout,
        extra.timeout,
      );

  const message = (
    <>
      <p>
        {t('This may be triggered by:')}
        <br />
        {extra.issue_codes
          .map<React.ReactNode>(issueCode => <IssueCode {...issueCode} />)
          .reduce((prev, curr) => [prev, <br />, curr])}
      </p>
      {isVisualization && extra.owners && (
        <>
          <br />
          <p>
            {tn(
              'Please reach out to the Chart Owner for assistance.',
              'Please reach out to the Chart Owners for assistance.',
              extra.owners.length,
            )}
          </p>
          <p>
            {tn(
              'Chart Owner: %s',
              'Chart Owners: %s',
              extra.owners.length,
              extra.owners.join(', '),
            )}
          </p>
        </>
      )}
    </>
  );

  const copyText = `${title}
${t('This may be triggered by:')}
${extra.issue_codes.map(issueCode => issueCode.message).join('\n')}`;

  return (
    <ErrorAlert>
      <div className="top-row">
        <LeftSideContent>
          <Icon
            className="icon"
            name="error"
            color={supersetTheme.colors.error.base}
          />
          <strong>{t('Timeout Error')}</strong>
        </LeftSideContent>
        {!isExpandable && (
          <a href="#" className="link" onClick={() => setIsModalOpen(true)}>
            {t('See More')}
          </a>
        )}
      </div>
      {isExpandable ? (
        <div className="error-body">
          <p>{title}</p>
          {!isMessageExpanded && (
            <a
              href="#"
              className="link"
              onClick={() => setIsMessageExpanded(true)}
            >
              {t('See More')}
            </a>
          )}
          {isMessageExpanded && (
            <>
              <br />
              {message}
              <a
                href="#"
                className="link"
                onClick={() => setIsMessageExpanded(false)}
              >
                {t('See Less')}
              </a>
            </>
          )}
        </div>
      ) : (
        <ErrorModal show={isModalOpen} onHide={() => setIsModalOpen(false)}>
          <Modal.Header className="header">
            <LeftSideContent>
              <Icon
                className="icon"
                name="error"
                color={supersetTheme.colors.error.base}
              />
              <div className="title">{t('Timeout Error')}</div>
            </LeftSideContent>
            <span
              role="button"
              tabIndex={0}
              onClick={() => setIsModalOpen(false)}
            >
              <Icon name="close" />
            </span>
          </Modal.Header>
          <Modal.Body>
            <p>{title}</p>
            <br />
            {message}
          </Modal.Body>
          <Modal.Footer>
            <CopyToClipboard
              text={copyText}
              shouldShowText={false}
              wrapped={false}
              copyNode={<Button onClick={noOp}>{t('Copy Message')}</Button>}
            />
            <Button bsStyle="primary" onClick={() => setIsModalOpen(false)}>
              {t('Close')}
            </Button>
          </Modal.Footer>
        </ErrorModal>
      )}
    </ErrorAlert>
  );
}

export default TimeoutErrorMessage;
