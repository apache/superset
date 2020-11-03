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
import { t, styled } from '@superset-ui/core';
import TooltipWrapper from './TooltipWrapper';
import Icon from './Icon';

interface FaveStarProps {
  itemId: number;
  fetchFaveStar?: (id: number) => void;
  saveFaveStar(id: number, isStarred: boolean): any;
  isStarred: boolean;
  showTooltip?: boolean;
}

const StyledLink = styled.a`
  font-size: ${({ theme }) => theme.typography.sizes.xl}px;
`;

export default class FaveStar extends React.PureComponent<FaveStarProps> {
  componentDidMount() {
    if (this.props.fetchFaveStar) {
      this.props.fetchFaveStar(this.props.itemId);
    }
  }

  onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    this.props.saveFaveStar(this.props.itemId, this.props.isStarred);
  };

  render() {
    const content = (
      <StyledLink
        href="#"
        onClick={this.onClick}
        className="fave-unfave-icon"
        data-test="fave-unfave-icon"
      >
        <Icon
          name={
            this.props.isStarred ? 'favorite-selected' : 'favorite-unselected'
          }
        />
      </StyledLink>
    );

    if (this.props.showTooltip) {
      return (
        <TooltipWrapper
          label="fave-unfave"
          tooltip={t('Click to favorite/unfavorite')}
        >
          {content}
        </TooltipWrapper>
      );
    }

    return content;
  }
}
