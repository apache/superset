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
import React, { EventHandler, ChangeEvent, MouseEvent, ReactNode } from 'react';
import { t, SupersetTheme } from '@superset-ui/core';
import SupersetText from 'src/utils/textUtils';
import Button from 'src/components/Button';
import { StyledInputContainer, wideButton } from './styles';
import { DatabaseObject } from '../types';

const SqlAlchemyTab = ({
  db,
  onInputChange,
  testConnection,
  conf,
  testInProgress = false,
  children,
}: {
  db: DatabaseObject | null;
  onInputChange: EventHandler<ChangeEvent<HTMLInputElement>>;
  testConnection: EventHandler<MouseEvent<HTMLElement>>;
  conf: { SQLALCHEMY_DOCS_URL: string; SQLALCHEMY_DISPLAY_TEXT: string };
  testInProgress?: boolean;
  children?: ReactNode;
}) => {
  let fallbackDocsUrl;
  let fallbackDisplayText;
  if (SupersetText) {
    fallbackDocsUrl =
      SupersetText.DB_MODAL_SQLALCHEMY_FORM?.SQLALCHEMY_DOCS_URL;
    fallbackDisplayText =
      SupersetText.DB_MODAL_SQLALCHEMY_FORM?.SQLALCHEMY_DISPLAY_TEXT;
  } else {
    fallbackDocsUrl = 'https://docs.sqlalchemy.org/en/13/core/engines.html';
    fallbackDisplayText = 'SQLAlchemy docs';
  }
  return (
    <>
      <StyledInputContainer>
        <div className="control-label">
          {t('Display Name')}
          <span className="required">*</span>
        </div>
        <div className="input-container">
          <input
            type="text"
            name="database_name"
            data-test="database-name-input"
            value={db?.database_name || ''}
            placeholder={t('Name your database')}
            onChange={onInputChange}
          />
        </div>
        <div className="helper">
          {t('Pick a name to help you identify this database.')}
        </div>
      </StyledInputContainer>
      <StyledInputContainer>
        <div className="control-label">
          {t('SQLAlchemy URI')}
          <span className="required">*</span>
        </div>
        <div className="input-container">
          <input
            type="text"
            name="sqlalchemy_uri"
            data-test="sqlalchemy-uri-input"
            value={db?.sqlalchemy_uri || ''}
            autoComplete="off"
            placeholder={t(
              'dialect+driver://username:password@host:port/database',
            )}
            onChange={onInputChange}
          />
        </div>
        <div className="helper">
          {t('Refer to the')}{' '}
          <a
            href={fallbackDocsUrl || conf?.SQLALCHEMY_DOCS_URL || ''}
            target="_blank"
            rel="noopener noreferrer"
          >
            {fallbackDisplayText || conf?.SQLALCHEMY_DISPLAY_TEXT || ''}
          </a>{' '}
          {t('for more information on how to structure your URI.')}
        </div>
      </StyledInputContainer>
      {children}
      <Button
        onClick={testConnection}
        loading={testInProgress}
        cta
        buttonStyle="link"
        css={(theme: SupersetTheme) => wideButton(theme)}
      >
        {t('Test connection')}
      </Button>
    </>
  );
};
export default SqlAlchemyTab;
