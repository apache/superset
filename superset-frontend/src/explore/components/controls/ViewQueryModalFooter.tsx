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
import { isObject } from 'lodash';
import { t, SupersetClient } from '@superset-ui/core';
import Button from 'src/components/Button';
import { useHistory } from 'react-router-dom';

interface SimpleDataSource {
  id: string;
  sql: string;
  type: string;
}

interface ViewQueryModalFooterProps {
  closeModal?: Function;
  changeDatasource?: Function;
  datasource?: SimpleDataSource;
}

const CLOSE = t('Close');
const SAVE_AS_DATASET = t('Save as Dataset');
const OPEN_IN_SQL_LAB = t('Open in SQL Lab');

const ViewQueryModalFooter: React.FC<ViewQueryModalFooterProps> = (props: {
  closeModal: () => void;
  changeDatasource: () => void;
  datasource: SimpleDataSource;
}) => {
  const history = useHistory();
  const viewInSQLLab = (
    openInNewWindow: boolean,
    id: string,
    type: string,
    sql: string,
  ) => {
    const payload = {
      datasourceKey: `${id}__${type}`,
      sql,
    };
    if (openInNewWindow) {
      SupersetClient.postForm('/sqllab/', payload);
    } else {
      history.push({
        pathname: '/sqllab',
        state: {
          requestedQuery: payload,
        },
      });
    }
  };

  const openSQL = (openInNewWindow: boolean) => {
    const { datasource } = props;
    if (isObject(datasource)) {
      const { id, type, sql } = datasource;
      viewInSQLLab(openInNewWindow, id, type, sql);
    }
  };
  return (
    <div>
      <Button
        onClick={() => {
          props?.closeModal?.();
          props?.changeDatasource?.();
        }}
      >
        {SAVE_AS_DATASET}
      </Button>
      <Button onClick={({ metaKey }) => openSQL(Boolean(metaKey))}>
        {OPEN_IN_SQL_LAB}
      </Button>
      <Button
        buttonStyle="primary"
        onClick={() => {
          props?.closeModal?.();
        }}
      >
        {CLOSE}
      </Button>
    </div>
  );
};

export default ViewQueryModalFooter;
