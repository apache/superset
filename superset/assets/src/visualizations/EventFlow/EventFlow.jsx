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
import { App, withParentSize } from '@data-ui/event-flow';
import { t } from '@superset-ui/translation';

const propTypes = {
  className: PropTypes.string,
  data: PropTypes.array,
  initialMinEventCount: PropTypes.number,
};
const defaultProps = {
  className: '',
  data: null,
};

function isExplorer() {
  return (/explore/).test(window.location.pathname);
}

// The slice container overflows ~80px in explorer,
// so we have to correct for this.
const ResponsiveVis = withParentSize(({
  parentWidth,
  parentHeight,
  ...rest
}) => (
  <App
    width={parentWidth}
    height={parentHeight - (isExplorer() ? 80 : 0)}
    {...rest}
  />
));

function CustomEventFlow(props) {
  const { data, initialMinEventCount } = props;
  if (data) {
    return (
      <ResponsiveVis
        data={data}
        initialMinEventCount={initialMinEventCount}
      />
    );
  }
  return (
    <div>{t('Sorry, there appears to be no data')}</div>
  );
}

CustomEventFlow.propTypes = propTypes;
CustomEventFlow.defaultProps = defaultProps;

export default CustomEventFlow;
