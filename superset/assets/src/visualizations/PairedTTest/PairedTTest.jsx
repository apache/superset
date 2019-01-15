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
import React from 'react';
import TTestTable, { dataPropType } from './TTestTable';
import './PairedTTest.css';

const propTypes = {
  className: PropTypes.string,
  metrics: PropTypes.arrayOf(PropTypes.string).isRequired,
  groups: PropTypes.arrayOf(PropTypes.string).isRequired,
  data: PropTypes.objectOf(dataPropType).isRequired,
  alpha: PropTypes.number,
  liftValPrec: PropTypes.number,
  pValPrec: PropTypes.number,
};

const defaultProps = {
  className: '',
  alpha: 0.05,
  liftValPrec: 4,
  pValPrec: 6,
};

class PairedTTest extends React.PureComponent {
  render() {
    const {
      className,
      metrics,
      groups,
      data,
      alpha,
      pValPrec,
      liftValPrec,
    } = this.props;
    return (
      <div className={`paired-ttest-table scrollbar-container ${className}`}>
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
    );
  }
}

PairedTTest.propTypes = propTypes;
PairedTTest.defaultProps = defaultProps;

export default PairedTTest;
