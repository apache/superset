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
import React, { useState, ReactNode } from 'react';
import { Modal } from 'react-bootstrap';
import { styled, supersetTheme } from '@superset-ui/style';
import { t } from '@superset-ui/translation';
import { noOp } from 'src/utils/common';
import Button from 'src/components/Button';

import Icon from '../Icon';
import { ErrorLevel, ErrorSource } from './types';
import CopyToClipboard from '../CopyToClipboard';

const ErrorAlertDiv = styled.div<{ level: ErrorLevel }>`
  align-items: center;
  background-color: ${({ level, theme }) => theme.colors[level].light2};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: 1px solid ${({ level, theme }) => theme.colors[level].base};
  color: ${({ level, theme }) => theme.colors[level].dark2};
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
    color: ${({ level, theme }) => theme.colors[level].dark2};
    text-decoration: underline;
  }
`;

const ErrorModal = styled(Modal)<{ level: ErrorLevel }>`
  color: ${({ level, theme }) => theme.colors[level].dark2};
  overflow-wrap: break-word;

  .icon {
    margin-right: ${({ theme }) => 2 * theme.gridUnit}px;
  }

  .header {
    align-items: center;
    background-color: ${({ level, theme }) => theme.colors[level].light2};
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

interface ErrorAlertProps {
  body: ReactNode;
  copyText?: string;
  level: ErrorLevel;
  source?: ErrorSource;
  subtitle: ReactNode;
  title: ReactNode;
}

export default function ErrorAlert({
  body,
  copyText,
  level,
  source = 'dashboard',
  subtitle,
  title,
}: ErrorAlertProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBodyExpanded, setIsBodyExpanded] = useState(false);

  const isExpandable = ['explore', 'sqllab'].includes(source);

  return (
    <ErrorAlertDiv level={level}>
      <div className="top-row">
        <LeftSideContent>
          <Icon
            className="icon"
            name={level === 'error' ? 'error' : 'warning'}
            color={supersetTheme.colors[level].base}
          />
          <strong>{title}</strong>
        </LeftSideContent>
        {!isExpandable && (
          <a href="#" className="link" onClick={() => setIsModalOpen(true)}>
            {t('See More')}
          </a>
        )}
      </div>
      {isExpandable ? (
        <div className="error-body">
          <p>{subtitle}</p>
          {body && (
            <>
              {!isBodyExpanded && (
                <a
                  href="#"
                  className="link"
                  onClick={() => setIsBodyExpanded(true)}
                >
                  {t('See More')}
                </a>
              )}
              {isBodyExpanded && (
                <>
                  <br />
                  {body}
                  <a
                    href="#"
                    className="link"
                    onClick={() => setIsBodyExpanded(false)}
                  >
                    {t('See Less')}
                  </a>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <ErrorModal
          level={level}
          show={isModalOpen}
          onHide={() => setIsModalOpen(false)}
        >
          <Modal.Header className="header">
            <LeftSideContent>
              <Icon
                className="icon"
                name={level === 'error' ? 'error' : 'warning'}
                color={supersetTheme.colors[level].base}
              />
              <div className="title">{title}</div>
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
            <p>{subtitle}</p>
            <br />
            {body}
          </Modal.Body>
          <Modal.Footer>
            {copyText && (
              <CopyToClipboard
                text={copyText}
                shouldShowText={false}
                wrapped={false}
                copyNode={<Button onClick={noOp}>{t('Copy Message')}</Button>}
              />
            )}
            <Button
              cta
              buttonStyle="primary"
              onClick={() => setIsModalOpen(false)}
            >
              {t('Close')}
            </Button>
          </Modal.Footer>
        </ErrorModal>
      )}
    </ErrorAlertDiv>
  );
}
