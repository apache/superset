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
import { getDatabaseDocumentationLinks } from 'src/views/CRUD/hooks';
import { UploadFile } from 'antd/lib/upload/interface';
import { t } from '@superset-ui/core';
import {
  EditHeaderTitle,
  EditHeaderSubtitle,
  StyledFormHeader,
  StyledStickyHeader,
} from './styles';
import { DatabaseForm, DatabaseObject } from '../types';

const supersetTextDocs = getDatabaseDocumentationLinks();

export const DOCUMENTATION_LINK = supersetTextDocs
  ? supersetTextDocs.support
  : 'https://superset.apache.org/docs/databases/installing-database-drivers';

const irregularDocumentationLinks = {
  postgresql: 'https://superset.apache.org/docs/databases/postgres',
  mssql: 'https://superset.apache.org/docs/databases/sql-server',
  gsheets: 'https://superset.apache.org/docs/databases/google-sheets',
};

const documentationLink = (engine: string | undefined) => {
  if (!engine) return null;

  if (supersetTextDocs) {
    // override doc link for superset_txt yml
    return supersetTextDocs[engine] || supersetTextDocs.default;
  }

  if (!irregularDocumentationLinks[engine]) {
    return `https://superset.apache.org/docs/databases/${engine}`;
  }
  return irregularDocumentationLinks[engine];
};

const ModalHeader = ({
  isLoading,
  isEditMode,
  useSqlAlchemyForm,
  hasConnectedDb,
  db,
  dbName,
  dbModel,
  editNewDb,
  fileList,
}: {
  isLoading: boolean;
  isEditMode: boolean;
  useSqlAlchemyForm: boolean;
  hasConnectedDb: boolean;
  db: Partial<DatabaseObject> | null;
  dbName: string;
  dbModel: DatabaseForm;
  editNewDb?: boolean;
  fileList?: UploadFile[];
  passwordFields?: string[];
  needsOverwriteConfirm?: boolean;
}) => {
  const fileCheck = fileList && fileList?.length > 0;

  const isEditHeader = (
    <StyledFormHeader>
      <EditHeaderTitle>{db?.backend}</EditHeaderTitle>
      <EditHeaderSubtitle>{dbName}</EditHeaderSubtitle>
    </StyledFormHeader>
  );

  const useSqlAlchemyFormHeader = (
    <StyledFormHeader>
      <p className="helper-top"> STEP 2 OF 2 </p>
      <h4>Enter Primary Credentials</h4>
      <p className="helper-bottom">
        Need help? Learn how to connect your database{' '}
        <a
          href={supersetTextDocs?.default || DOCUMENTATION_LINK}
          target="_blank"
          rel="noopener noreferrer"
        >
          here
        </a>
        .
      </p>
    </StyledFormHeader>
  );

  const hasConnectedDbHeader = (
    <StyledStickyHeader>
      <StyledFormHeader>
        <p className="helper-top"> STEP 3 OF 3 </p>
        <h4 className="step-3-text">Database connected</h4>
        <p className="subheader-text">
          {t(`Create a dataset to begin visualizing your data as a chart or go to
          SQL Lab to query your data.`)}
        </p>
      </StyledFormHeader>
    </StyledStickyHeader>
  );

  const hasDbHeader = (
    <StyledStickyHeader>
      <StyledFormHeader>
        <p className="helper-top"> STEP 2 OF 3 </p>
        <h4>Enter the required {dbModel.name} credentials</h4>
        <p className="helper-bottom">
          Need help? Learn more about{' '}
          <a
            href={documentationLink(db?.engine)}
            target="_blank"
            rel="noopener noreferrer"
          >
            connecting to {dbModel.name}.
          </a>
        </p>
      </StyledFormHeader>
    </StyledStickyHeader>
  );

  const noDbHeader = (
    <StyledFormHeader>
      <div className="select-db">
        <p className="helper-top"> STEP 1 OF 3 </p>
        <h4>{t('Select a database to connect')}</h4>
      </div>
    </StyledFormHeader>
  );

  const importDbHeader = (
    <StyledStickyHeader>
      <StyledFormHeader>
        <p className="helper-top"> STEP 2 OF 2 </p>
        <h4>Enter the required {dbModel.name} credentials</h4>
        <p className="helper-bottom">{fileCheck ? fileList[0].name : ''}</p>
      </StyledFormHeader>
    </StyledStickyHeader>
  );

  if (fileCheck) return importDbHeader;
  if (isLoading) return <></>;
  if (isEditMode) return isEditHeader;
  if (useSqlAlchemyForm) return useSqlAlchemyFormHeader;
  if (hasConnectedDb && !editNewDb) return hasConnectedDbHeader;
  if (db || editNewDb) return hasDbHeader;

  return noDbHeader;
};

export default ModalHeader;
