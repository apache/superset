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
import { Tooltip } from 'src/common/components/Tooltip';
import { t, styled, supersetTheme } from '@superset-ui/core';
import cx from 'classnames';

import Button from 'src/components/Button';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import Icon from 'src/components/Icon';
import CopyToClipboard from 'src/components/CopyToClipboard';
import { storeQuery } from 'src/utils/common';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { FeatureFlag, isFeatureEnabled } from '../../featureFlags';

interface ShareSqlLabQueryPropTypes {
  queryEditor: {
    dbId: number;
    title: string;
    schema: string;
    autorun: boolean;
    sql: string;
    remoteId: number | null;
  };
  addDangerToast: (msg: string) => void;
}

const Styles = styled.div`
  .btn-disabled {
    &,
    &:hover {
      cursor: default;
      background-color: ${supersetTheme.colors.grayscale.light2};
      color: ${supersetTheme.colors.grayscale.base};
    }
  }
  svg {
    vertical-align: -${supersetTheme.gridUnit * 1.25}px;
  }
`;

function ShareSqlLabQuery({
  queryEditor,
  addDangerToast,
}: ShareSqlLabQueryPropTypes) {
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

  const buildButton = () => {
    const canShare =
      queryEditor.remoteId ||
      isFeatureEnabled(FeatureFlag.SHARE_QUERIES_VIA_KV_STORE);
    return (
      <Styles>
        <Button buttonSize="small" className={cx(!canShare && 'btn-disabled')}>
          <Icon
            name="link"
            color={
              canShare
                ? supersetTheme.colors.primary.base
                : supersetTheme.colors.grayscale.base
            }
            width={20}
            height={20}
          />{' '}
          {t('Copy link')}
        </Button>
      </Styles>
    );
  };

  const canShare =
    queryEditor.remoteId ||
    isFeatureEnabled(FeatureFlag.SHARE_QUERIES_VIA_KV_STORE);

  return (
    <Tooltip
      id="copy_link"
      placement="top"
      overlayStyle={{
        fontSize: supersetTheme.typography.sizes.s,
        lineHeight: '1.6',
        maxWidth: '125px',
      }}
      title={
        canShare
          ? t('Copy query link to your clipboard')
          : t('Save the query to enable this feature')
      }
    >
      {canShare ? (
        <CopyToClipboard
          getText={getCopyUrl}
          wrapped={false}
          copyNode={buildButton()}
        />
      ) : (
        buildButton()
      )}
    </Tooltip>
  );
}

export default withToasts(ShareSqlLabQuery);
