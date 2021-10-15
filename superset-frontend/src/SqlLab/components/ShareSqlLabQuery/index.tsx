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
import { t, useTheme, styled } from '@superset-ui/core';
import Button from 'src/components/Button';
import Icons from 'src/components/Icons';
import withToasts from 'src/components/MessageToasts/withToasts';
import CopyToClipboard from 'src/components/CopyToClipboard';
import { storeQuery } from 'src/utils/common';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { QueryEditor } from 'src/SqlLab/types';

interface ShareSqlLabQueryPropTypes {
  queryEditor: QueryEditor;
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

function ShareSqlLabQuery({
  queryEditor,
  addDangerToast,
}: ShareSqlLabQueryPropTypes) {
  const theme = useTheme();

  const getCopyUrlForKvStore = (callback: Function) => {
    const { dbId, title, schema, autorun, sql } = queryEditor;
    const sharedQuery = { dbId, title, schema, autorun, sql };

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

    if (queryEditor.remoteId) {
      savedQueryToastContent = `${
        window.location.origin + window.location.pathname
      }?savedQueryId=${queryEditor.remoteId}`;
      callback(savedQueryToastContent);
    } else {
      savedQueryToastContent = t('Please save the query to enable sharing');
      callback(savedQueryToastContent);
    }
  };
  const getCopyUrl = (callback: Function) => {
    if (isFeatureEnabled(FeatureFlag.SHARE_QUERIES_VIA_KV_STORE)) {
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
    !!queryEditor.remoteId ||
    isFeatureEnabled(FeatureFlag.SHARE_QUERIES_VIA_KV_STORE);

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
}

export default withToasts(ShareSqlLabQuery);
