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
import { t } from '@superset-ui/translation';
import TooltipWrapper from '../../components/TooltipWrapper';

const propTypes = {
  dashboardId: PropTypes.number.isRequired,
  isPublished: PropTypes.bool.isRequired,
  savePublished: PropTypes.func.isRequired,
  canEdit: PropTypes.bool.isRequired,
  canSave: PropTypes.bool.isRequired,
};

const draftButtonTooltip = t(
  'This dashboard is not published, it will not show up in the list of dashboards. ' +
    'Click here to publish this dashboard.',
);

const draftDivTooltip = t(
  'This dashboard is not published which means it will not show up in the list of dashboards.' +
    ' Favorite it to see it there or access it by using the URL directly.',
);

const publishedTooltip = t(
  'This dashboard is published. Click to make it a draft.',
);

const divStyle = {
  border: '1px dotted black',
  backgroundColor: '#F9F9F9',
  padding: '3px 7px 3px 7px',
  fontFamily: 'Monospace',
  fontSize: '16px',
};

export default class PublishedStatus extends React.Component {
  componentDidMount() {
    this.togglePublished = this.togglePublished.bind(this);
  }

  togglePublished() {
    this.props.savePublished(this.props.dashboardId, !this.props.isPublished);
  }

  render() {
    // Show everybody the draft badge
    if (!this.props.isPublished) {
      // if they can edit the dash, make the badge a button
      if (this.props.canEdit && this.props.canSave) {
        return (
          <TooltipWrapper
            label="Unpublished Dashboard"
            placement="bottom"
            tooltip={draftButtonTooltip}
          >
            <button
              style={divStyle}
              onClick={() => {
                this.togglePublished();
              }}
            >
              Draft
            </button>
          </TooltipWrapper>
        );
      }
      return (
        <TooltipWrapper
          label="Unpublished Dashboard"
          placement="bottom"
          tooltip={draftDivTooltip}
        >
          <div style={divStyle}>Draft</div>
        </TooltipWrapper>
      );
    }

    // Show the published badge for the owner of the dashboard to toggle
    else if (this.props.canEdit && this.props.canSave) {
      return (
        <TooltipWrapper
          label="Published Dashboard"
          placement="bottom"
          tooltip={publishedTooltip}
        >
          <button
            style={divStyle}
            onClick={() => {
              this.togglePublished();
            }}
          >
            Published
          </button>
        </TooltipWrapper>
      );
    }

    // Don't show anything if one doesn't own the dashboard and it is published
    return null;
  }
}

PublishedStatus.propTypes = propTypes;
