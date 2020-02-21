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

import { filterIndicatorPropShape } from '../util/propShapes';
import FilterBadgeIcon from '../../components/FilterBadgeIcon';
import FilterIndicatorTooltip from './FilterIndicatorTooltip';
import FilterTooltipWrapper from './FilterTooltipWrapper';

const propTypes = {
  indicator: filterIndicatorPropShape.isRequired,
  setDirectPathToChild: PropTypes.func.isRequired,
};

class FilterIndicator extends React.PureComponent {
  constructor(props) {
    super(props);

    const { indicator, setDirectPathToChild } = props;
    const { directPathToFilter } = indicator;
    this.focusToFilterComponent = setDirectPathToChild.bind(
      this,
      directPathToFilter,
    );
  }

  render() {
    const {
      colorCode,
      label,
      values,
      isFilterFieldActive,
    } = this.props.indicator;

    const filterTooltip = (
      <FilterIndicatorTooltip
        label={t(label)}
        values={values}
        clickIconHandler={this.focusToFilterComponent}
      />
    );

    return (
      <FilterTooltipWrapper tooltip={filterTooltip}>
        <div
          className={`filter-indicator ${isFilterFieldActive ? 'active' : ''}`}
          onClick={this.focusToFilterComponent}
          role="none"
        >
          <div className={`color-bar ${colorCode}`} />
          <FilterBadgeIcon colorCode={isEmpty(values) ? '' : colorCode} />
        </div>
      </FilterTooltipWrapper>
    );
  }
}

FilterIndicator.propTypes = propTypes;

export default FilterIndicator;
