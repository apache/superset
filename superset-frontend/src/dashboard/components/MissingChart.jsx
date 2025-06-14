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
import PropTypes from 'prop-types';
import { t } from '@superset-ui/core';

const propTypes = {
  height: PropTypes.number.isRequired,
};

export default function MissingChart({ height }) {
  return (
    <div className="missing-chart-container" style={{ height: height + 20 }}>
      <div className="missing-chart-body">
        {t(
          'There is no chart definition associated with this component, could it have been deleted?',
        )}
        <br />
        <br />
        {t('Delete this container and save to remove this message.')}
      </div>
    </div>
  );
}

MissingChart.propTypes = propTypes;
