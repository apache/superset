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
import { t } from '@superset-ui/translation';
import TooltipWrapper from './TooltipWrapper';
import Icon from './Icon';

interface FaveStarProps {
  itemId: number;
  fetchFaveStar(id: number): any;
  saveFaveStar(id: number, isStarred: boolean): any;
  isStarred: boolean;
  width?: number;
  height?: number;
  showTooltip?: boolean;
}

export default class FaveStar extends React.PureComponent<FaveStarProps> {
  componentDidMount() {
    this.props.fetchFaveStar(this.props.itemId);
  }

  onClick(e: React.MouseEvent) {
    e.preventDefault();
    this.props.saveFaveStar(this.props.itemId, this.props.isStarred);
  }

  render() {
    if (this.props.showTooltip) {
      return (
        <TooltipWrapper
          label="fave-unfave"
          tooltip={t('Click to favorite/unfavorite')}
        >
          <a
            href="#"
            onClick={this.onClick.bind(this)}
            className="fave-unfave-icon"
          >
            <Icon
              name={
                this.props.isStarred
                  ? 'favorite-selected'
                  : 'favorite-unselected'
              }
              viewBox="0 0 16 15"
              width={this.props.width || 20}
              height="auto"
            />
          </a>
        </TooltipWrapper>
      );
    }

    return (
      <a
        href="#"
        onClick={this.onClick.bind(this)}
        className="fave-unfave-icon"
      >
        <Icon
          name={
            this.props.isStarred ? 'favorite-selected' : 'favorite-unselected'
          }
          viewBox="0 0 16 15"
          width={this.props.width || 20}
          height={this.props.height || 'auto'}
        />
      </a>
    );
  }
}
