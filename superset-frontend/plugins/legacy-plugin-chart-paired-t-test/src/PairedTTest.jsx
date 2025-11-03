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
import { PureComponent } from 'react';
import { styled } from '@superset-ui/core';
import TTestTable, { dataPropType } from './TTestTable';

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

const StyledDiv = styled.div`
  ${({ theme }) => `
    .superset-legacy-chart-paired_ttest .scrollbar-container {
      overflow: auto;
    }

    .paired-ttest-table .scrollbar-content {
      padding-left: ${theme.sizeUnit}px;
      padding-right: ${theme.sizeUnit}px;
      margin-bottom: 0;
    }

    .paired-ttest-table table {
      margin-bottom: 0;
    }

    .paired-ttest-table h1 {
      margin-left: ${theme.sizeUnit}px;
    }

    .reactable-data tr {
      font-feature-settings: 'tnum' 1;
    }

    .reactable-data tr,
    .reactable-header-sortable {
      -webkit-transition: ease-in-out 0.1s;
      transition: ease-in-out 0.1s;
    }

    .reactable-data tr:hover {
      background-color: ${theme.colorFillTertiary};
    }

    .reactable-data tr .false {
      color: ${theme.colorError};
    }

    .reactable-data tr .true {
      color: ${theme.colorSuccess};
    }

    .reactable-data tr .control {
      color: ${theme.colorPrimary};
    }

    .reactable-data tr .invalid {
      color: ${theme.colorWarning};
    }

    .reactable-data .control td {
      background-color: ${theme.colorFillTertiary};
    }

    .reactable-header-sortable:hover,
    .reactable-header-sortable:focus,
    .reactable-header-sort-asc,
    .reactable-header-sort-desc {
      background-color: ${theme.colorFillTertiary};
      position: relative;
    }

    .reactable-header-sort-asc:after {
      content: '\\25bc';
      position: absolute;
      right: ${theme.sizeUnit * 3}px;
    }

    .reactable-header-sort-desc:after {
      content: '\\25b2';
      position: absolute;
      right: ${theme.sizeUnit * 3}px;
    }
  `}
`;

class PairedTTest extends PureComponent {
  render() {
    const { className, metrics, groups, data, alpha, pValPrec, liftValPrec } =
      this.props;

    return (
      <StyledDiv>
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
      </StyledDiv>
    );
  }
}

PairedTTest.propTypes = propTypes;
PairedTTest.defaultProps = defaultProps;

export default PairedTTest;
