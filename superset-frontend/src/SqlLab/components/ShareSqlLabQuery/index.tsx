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
import {
  t,
  getClientErrorObject,
  SupersetClient,
  css,
} from '@superset-ui/core';
import { Button } from '@superset-ui/core/components';
import { CopyToClipboard } from 'src/components';
import { Icons } from '@superset-ui/core/components/Icons';
import withToasts from 'src/components/MessageToasts/withToasts';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import { LOG_ACTIONS_SQLLAB_COPY_LINK } from 'src/logger/LogUtils';
import useLogAction from 'src/logger/useLogAction';

interface ShareSqlLabQueryProps {
  queryEditorId: string;
  addDangerToast: (msg: string) => void;
}

const ShareSqlLabQuery = ({
  queryEditorId,
  addDangerToast,
}: ShareSqlLabQueryProps) => {
  const logAction = useLogAction({ queryEditorId });
  const { dbId, name, schema, autorun, sql, templateParams } = useQueryEditor(
    queryEditorId,
    ['dbId', 'name', 'schema', 'autorun', 'sql', 'templateParams'],
  );

  const getCopyUrlForPermalink = (callback: Function) => {
    const sharedQuery = { dbId, name, schema, autorun, sql, templateParams };

    return SupersetClient.post({
      endpoint: '/api/v1/sqllab/permalink',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sharedQuery),
    })
      .then(({ json }) => {
        callback(json.url);
      })
      .catch(response => {
        getClientErrorObject(response).then(() => {
          addDangerToast(t('There was an error with your request'));
        });
      });
  };

  const getCopyUrl = (callback: Function) => {
    logAction(LOG_ACTIONS_SQLLAB_COPY_LINK, {
      shortcut: false,
    });
    return getCopyUrlForPermalink(callback);
  };

  const buildButton = () => {
    const tooltip = t('Copy query link to your clipboard');
    return (
      <Button
        buttonSize="small"
        buttonStyle="secondary"
        tooltip={tooltip}
        css={css`
          span > :first-of-type {
            margin-right: 0;
          }
        `}
      >
        <Icons.LinkOutlined iconSize="m" />
        {t('Copy link')}
      </Button>
    );
  };

  return (
    <CopyToClipboard
      getText={getCopyUrl}
      wrapped={false}
      copyNode={buildButton()}
    />
  );
};

export default withToasts(ShareSqlLabQuery);
