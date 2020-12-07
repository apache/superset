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
import { t } from '@superset-ui/core';

import URLShortLinkButton from './URLShortLinkButton';
import getDashboardUrl from '../dashboard/util/getDashboardUrl';
import getLocationHash from '../dashboard/util/getLocationHash';

const propTypes = {
  anchorLinkId: PropTypes.string.isRequired,
  filters: PropTypes.object,
  showShortLinkButton: PropTypes.bool,
  inFocus: PropTypes.bool,
  placement: PropTypes.oneOf(['right', 'left', 'top', 'bottom']),
};

const defaultProps = {
  inFocus: false,
  showShortLinkButton: false,
  placement: 'right',
  filters: {},
};

class AnchorLink extends React.PureComponent {
  componentDidMount() {
    const hash = getLocationHash();
    const { anchorLinkId } = this.props;

    if (hash && anchorLinkId === hash) {
      this.scrollToView();
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { inFocus = false } = nextProps;
    if (inFocus) {
      this.scrollToView();
    }
  }

  scrollToView(delay = 0) {
    const { anchorLinkId } = this.props;
    const directLinkComponent = document.getElementById(anchorLinkId);
    if (directLinkComponent) {
      setTimeout(() => {
        directLinkComponent.scrollIntoView({
          block: 'center',
          behavior: 'smooth',
        });
      }, delay);
    }
  }

  render() {
    const {
      anchorLinkId,
      filters,
      showShortLinkButton,
      placement,
    } = this.props;
    return (
      <span className="anchor-link-container" id={anchorLinkId}>
        {showShortLinkButton && (
          <URLShortLinkButton
            url={getDashboardUrl(
              window.location.pathname,
              filters,
              anchorLinkId,
            )}
            emailSubject={t('Superset Chart')}
            emailContent={t('Check out this chart in dashboard:')}
            placement={placement}
          />
        )}
      </span>
    );
  }
}

AnchorLink.propTypes = propTypes;
AnchorLink.defaultProps = defaultProps;

export default AnchorLink;
