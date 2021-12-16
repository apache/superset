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
/* eslint-disable react/no-array-index-key */
import PropTypes from 'prop-types';
import React from 'react';
import TTestTable, { dataPropType } from './TTestTable';
import './PairedTTest.css';

const propTypes = {
  alpha: PropTypes.number,
  className: PropTypes.string,
  data: PropTypes.objectOf(dataPropType).isRequired,
  groups: PropTypes.arrayOf(PropTypes.string).isRequired,
  liftValPrec: PropTypes.number,
  metrics: PropTypes.arrayOf(PropTypes.string).isRequired,
  pValPrec: PropTypes.number,
};

const defaultProps = {
  alpha: 0.05,
  className: '',
  liftValPrec: 4,
  pValPrec: 6,
};

class PairedTTest extends React.PureComponent {
  render() {
    const { className, metrics, groups, data, alpha, pValPrec, liftValPrec } =
      this.props;

    return (
      <div className={`superset-legacy-chart-paired-t-test ${className}`}>
        <div className="paired-ttest-table">
          <div className="scrollbar-content">
            {metrics.map((metric, i) => (
              <TTestTable
                key={i}
                metric={metric}
                groups={groups}
                data={data[metric]}
                alpha={alpha}
                pValPrec={Math.min(pValPrec, 32)}
                liftValPrec={Math.min(liftValPrec, 32)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
}

PairedTTest.propTypes = propTypes;
PairedTTest.defaultProps = defaultProps;

export default PairedTTest;
