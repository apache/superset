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
import cx from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import { t, styled } from '@superset-ui/core';

const propTypes = {
  datasourceUrl: PropTypes.string,
  datasourceName: PropTypes.string,
  innerRef: PropTypes.func,
  isSelected: PropTypes.bool,
  lastModified: PropTypes.string,
  sliceName: PropTypes.string.isRequired,
  style: PropTypes.object,
  visType: PropTypes.string.isRequired,
};

const defaultProps = {
  datasourceUrl: null,
  datasourceName: '-',
  innerRef: null,
  isSelected: false,
  style: null,
  lastModified: null,
};

const Styled = styled.div`
  ${({ theme }) => `
    .chart-card {
      border: 1px solid ${theme.colors.grayscale.light2};
      border-radius: ${theme.gridUnit}px;
      background: ${theme.colors.grayscale.light5};
      padding: ${theme.gridUnit * 2}px;
      margin: 0 ${theme.gridUnit * 3}px
        ${theme.gridUnit * 3}px
        ${theme.gridUnit * 3}px;
      position: relative;
      cursor: move;
      white-space: nowrap;
      overflow: hidden;

      &:hover {
        background: ${theme.colors.grayscale.light4};
      }
    }

    .chart-card.is-selected {
      cursor: not-allowed;
      opacity: 0.4;
    }

    .card-title {
      margin-right: 60px;
      margin-bottom: ${theme.gridUnit * 2}px;
      font-weight: ${theme.typography.weights.bold};
    }

    .card-body {
      display: flex;
      flex-direction: column;

      .item {
        span {
          word-break: break-all;

          &:first-child {
            font-weight: ${theme.typography.weights.normal};
          }
        }
      }
    }

    .is-added-label {
      background: ${theme.colors.grayscale.base};
      border-radius: ${theme.gridUnit}px;
      color: ${theme.colors.grayscale.light5};
      font-size: ${theme.typography.sizes.s}px;
      text-transform: uppercase;
      position: absolute;
      padding: ${theme.gridUnit}px
        ${theme.gridUnit * 2}px;
      top: ${theme.gridUnit * 8}px;
      right: ${theme.gridUnit * 8}px;
      pointer-events: none;
    }
  `}
`;

function AddSliceCard({
  datasourceUrl,
  datasourceName,
  innerRef,
  isSelected,
  lastModified,
  sliceName,
  style,
  visType,
}) {
  return (
    <Styled ref={innerRef} style={style}>
      <div
        className={cx('chart-card', isSelected && 'is-selected')}
        data-test="chart-card"
      >
        <div className="card-title" data-test="card-title">
          {sliceName}
        </div>
        <div className="card-body">
          <div className="item">
            <span>{t('Modified')} </span>
            <span>{lastModified}</span>
          </div>
          <div className="item">
            <span>{t('Visualization')} </span>
            <span>{visType}</span>
          </div>
          <div className="item">
            <span>{t('Data source')} </span>
            <a href={datasourceUrl}>{datasourceName}</a>
          </div>
        </div>
      </div>
      {isSelected && <div className="is-added-label">{t('Added')}</div>}
    </Styled>
  );
}

AddSliceCard.propTypes = propTypes;
AddSliceCard.defaultProps = defaultProps;

export default AddSliceCard;
