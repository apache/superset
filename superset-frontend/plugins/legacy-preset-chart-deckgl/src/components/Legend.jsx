/* eslint-disable react/jsx-sort-default-props */
/* eslint-disable react/sort-prop-types */
/* eslint-disable jsx-a11y/anchor-is-valid */
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
import { formatNumber } from '@superset-ui/core';

import './Legend.css';

const categoryDelimiter = ' - ';

const propTypes = {
  categories: PropTypes.object,
  forceCategorical: PropTypes.bool,
  format: PropTypes.string,
  position: PropTypes.oneOf([null, 'tl', 'tr', 'bl', 'br']),
  showSingleCategory: PropTypes.func,
  toggleCategory: PropTypes.func,
};

const defaultProps = {
  categories: {},
  forceCategorical: false,
  format: null,
  position: 'tr',
  showSingleCategory: () => {},
  toggleCategory: () => {},
};

export default class Legend extends React.PureComponent {
  format(value) {
    if (!this.props.format || this.props.forceCategorical) {
      return value;
    }

    const numValue = parseFloat(value);

    return formatNumber(this.props.format, numValue);
  }

  formatCategoryLabel(k) {
    if (!this.props.format) {
      return k;
    }

    if (k.includes(categoryDelimiter)) {
      const values = k.split(categoryDelimiter);

      return (
        this.format(values[0]) + categoryDelimiter + this.format(values[1])
      );
    }

    return this.format(k);
  }

  render() {
    if (
      Object.keys(this.props.categories).length === 0 ||
      this.props.position === null
    ) {
      return null;
    }

    const categories = Object.entries(this.props.categories).map(([k, v]) => {
      const style = { color: `rgba(${v.color.join(', ')})` };
      const icon = v.enabled ? '\u25FC' : '\u25FB';

      return (
        <li key={k}>
          <a
            href="#"
            onClick={() => this.props.toggleCategory(k)}
            onDoubleClick={() => this.props.showSingleCategory(k)}
          >
            <span style={style}>{icon}</span> {this.formatCategoryLabel(k)}
          </a>
        </li>
      );
    });

    const vertical = this.props.position.charAt(0) === 't' ? 'top' : 'bottom';
    const horizontal = this.props.position.charAt(1) === 'r' ? 'right' : 'left';
    const style = {
      position: 'absolute',
      [vertical]: '0px',
      [horizontal]: '10px',
    };

    return (
      <div className="legend" style={style}>
        <ul className="categories">{categories}</ul>
      </div>
    );
  }
}

Legend.propTypes = propTypes;
Legend.defaultProps = defaultProps;
