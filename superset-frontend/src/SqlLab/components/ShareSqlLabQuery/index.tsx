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
  FeatureFlag,
  styled,
  t,
  useTheme,
  isFeatureEnabled,
  getClientErrorObject,
} from '@superset-ui/core';
import Button from 'src/components/Button';
import Icons from 'src/components/Icons';
import withToasts from 'src/components/MessageToasts/withToasts';
import CopyToClipboard from 'src/components/CopyToClipboard';
import { storeQuery } from 'src/utils/common';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import { LOG_ACTIONS_SQLLAB_COPY_LINK } from 'src/logger/LogUtils';
import useLogAction from 'src/logger/useLogAction';

interface ShareSqlLabQueryProps {
  queryEditorId: string;
  addDangerToast: (msg: string) => void;
}

const StyledIcon = styled(Icons.Link)`
  &:first-of-type {
    margin: 0;
    display: flex;
    svg {
      margin: 0;
    }
  }
`;

const ShareSqlLabQuery = ({
  queryEditorId,
  addDangerToast,
}: ShareSqlLabQueryProps) => {
  const theme = useTheme();
  const logAction = useLogAction({ queryEditorId });
  const { dbId, name, schema, autorun, sql, remoteId, templateParams } =
    useQueryEditor(queryEditorId, [
      'dbId',
      'name',
      'schema',
      'autorun',
      'sql',
      'remoteId',
      'templateParams',
    ]);

  const getCopyUrlForKvStore = (callback: Function) => {
    const sharedQuery = { dbId, name, schema, autorun, sql, templateParams };

    return storeQuery(sharedQuery)
      .then(shortUrl => {
        callback(shortUrl);
      })
      .catch(response => {
        getClientErrorObject(response).then(() => {
          addDangerToast(t('There was an error with your request'));
        });
      });
  };

  const getCopyUrlForSavedQuery = (callback: Function) => {
    let savedQueryToastContent;

    if (remoteId) {
      savedQueryToastContent = `${
        window.location.origin + window.location.pathname
      }?savedQueryId=${remoteId}`;
      callback(savedQueryToastContent);
    } else {
      savedQueryToastContent = t('Please save the query to enable sharing');
      callback(savedQueryToastContent);
    }
  };
  const getCopyUrl = (callback: Function) => {
    logAction(LOG_ACTIONS_SQLLAB_COPY_LINK, {
      shortcut: false,
    });
    if (isFeatureEnabled(FeatureFlag.ShareQueriesViaKvStore)) {
      return getCopyUrlForKvStore(callback);
    }
    return getCopyUrlForSavedQuery(callback);
  };

  const buildButton = (canShare: boolean) => {
    const tooltip = canShare
      ? t('Copy query link to your clipboard')
      : t('Save the query to enable this feature');
    return (
      <Button buttonSize="small" tooltip={tooltip} disabled={!canShare}>
        <StyledIcon
          iconColor={
            canShare ? theme.colors.primary.base : theme.colors.grayscale.base
          }
          iconSize="xl"
        />
        {t('Copy link')}
      </Button>
    );
  };

  const canShare =
    !!remoteId || isFeatureEnabled(FeatureFlag.ShareQueriesViaKvStore);

  return (
    <>
      {canShare ? (
        <CopyToClipboard
          getText={getCopyUrl}
          wrapped={false}
          copyNode={buildButton(canShare)}
        />
      ) : (
        buildButton(canShare)
      )}
    </>
  );
};

export default withToasts(ShareSqlLabQuery);
