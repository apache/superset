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
import { isEmpty } from 'lodash';

import FilterBadgeIcon from '../../components/FilterBadgeIcon';
import FilterIndicatorTooltip from './FilterIndicatorTooltip';
import FilterTooltipWrapper from './FilterTooltipWrapper';
import { filterIndicatorPropShape } from '../util/propShapes';

const propTypes = {
  indicators: PropTypes.arrayOf(filterIndicatorPropShape).isRequired,
  setDirectPathToChild: PropTypes.func.isRequired,
};

class FilterIndicatorGroup extends React.PureComponent {
  constructor(props) {
    super(props);

    const { indicators, setDirectPathToChild } = this.props;
    this.onClickIcons = indicators.map(indicator =>
      setDirectPathToChild.bind(this, indicator.directPathToFilter),
    );
  }

  render() {
    const { indicators } = this.props;
    const hasFilterFieldActive = indicators.some(
      indicator => indicator.isFilterFieldActive,
    );
    const hasFilterApplied = indicators.some(
      indicator => !isEmpty(indicator.values),
    );

    return (
      <FilterTooltipWrapper
        tooltip={
          <React.Fragment>
            <div className="group-title">
              {t('%s filters', indicators.length)}
            </div>
            <ul className="tooltip-group">
              {indicators.map((indicator, index) => (
                <li key={`${indicator.chartId}_${indicator.name}`}>
                  <FilterIndicatorTooltip
                    clickIconHandler={this.onClickIcons[index]}
                    label={indicator.label}
                    values={indicator.values}
                  />
                </li>
              ))}
            </ul>
          </React.Fragment>
        }
      >
        <div
          className={`filter-indicator-group ${
            hasFilterFieldActive ? 'active' : ''
          }`}
        >
          <div className="color-bar badge-group" />
          <FilterBadgeIcon colorCode={hasFilterApplied ? 'badge-group' : ''} />
        </div>
      </FilterTooltipWrapper>
    );
  }
}

FilterIndicatorGroup.propTypes = propTypes;

export default FilterIndicatorGroup;
