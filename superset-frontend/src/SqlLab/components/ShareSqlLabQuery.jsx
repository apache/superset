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
import PropTypes from 'prop-types';
import Popover from 'src/common/components/Popover';
import { t } from '@superset-ui/core';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';

import Button from 'src/components/Button';
import CopyToClipboard from '../../components/CopyToClipboard';
import { storeQuery } from '../../utils/common';
import getClientErrorObject from '../../utils/getClientErrorObject';
import withToasts from '../../messageToasts/enhancers/withToasts';

const propTypes = {
  queryEditor: PropTypes.shape({
    dbId: PropTypes.number,
    title: PropTypes.string,
    schema: PropTypes.string,
    autorun: PropTypes.bool,
    sql: PropTypes.string,
    remoteId: PropTypes.number,
  }).isRequired,
  addDangerToast: PropTypes.func.isRequired,
};

class ShareSqlLabQuery extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      shortUrl: t('Loading ...'),
    };
    this.getCopyUrl = this.getCopyUrl.bind(this);
  }

  getCopyUrl() {
    if (isFeatureEnabled(FeatureFlag.SHARE_QUERIES_VIA_KV_STORE)) {
      return this.getCopyUrlForKvStore();
    }

    return this.getCopyUrlForSavedQuery();
  }

  getCopyUrlForKvStore() {
    const { dbId, title, schema, autorun, sql } = this.props.queryEditor;
    const sharedQuery = { dbId, title, schema, autorun, sql };

    return storeQuery(sharedQuery)
      .then(shortUrl => {
        this.setState({ shortUrl });
      })
      .catch(response => {
        getClientErrorObject(response).then(({ error }) => {
          this.props.addDangerToast(error);
          this.setState({ shortUrl: t('Error') });
        });
      });
  }

  getCopyUrlForSavedQuery() {
    let savedQueryToastContent;

    if (this.props.queryEditor.remoteId) {
      savedQueryToastContent = `${
        window.location.origin + window.location.pathname
      }?savedQueryId=${this.props.queryEditor.remoteId}`;
      this.setState({ shortUrl: savedQueryToastContent });
    } else {
      savedQueryToastContent = t('Please save the query to enable sharing');
      this.setState({ shortUrl: savedQueryToastContent });
    }
  }

  renderPopover() {
    return (
      <div id="sqllab-shareurl-popover">
        <CopyToClipboard
          text={this.state.shortUrl || t('Loading ...')}
          copyNode={
            <i className="fa fa-clipboard" title={t('Copy to clipboard')} />
          }
        />
      </div>
    );
  }

  render() {
    return (
      <Popover
        trigger="click"
        placement="top"
        onClick={this.getCopyUrl}
        content={this.renderPopover()}
      >
        <Button buttonSize="small">
          <i className="fa fa-share" /> {t('Share')}
        </Button>
      </Popover>
    );
  }
}

ShareSqlLabQuery.propTypes = propTypes;

export default withToasts(ShareSqlLabQuery);
