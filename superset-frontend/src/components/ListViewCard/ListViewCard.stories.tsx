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
import { action } from '@storybook/addon-actions';
import { withKnobs, boolean, select, text } from '@storybook/addon-knobs';
import DashboardImg from 'images/dashboard-card-fallback.png';
import ChartImg from 'images/chart-card-fallback.png';
import { Dropdown, Menu } from 'src/common/components';
import Icon from 'src/components/Icon';
import FaveStar from 'src/components/FaveStar';
import ListViewCard from '.';

export default {
  title: 'ListViewCard',
  component: ListViewCard,
  decorators: [withKnobs],
};

const imgFallbackKnob = {
  label: 'Fallback/Loading Image',
  options: {
    Dashboard: DashboardImg,
    Chart: ChartImg,
  },
  defaultValue: DashboardImg,
};

export const SupersetListViewCard = () => {
  return (
    <ListViewCard
      title="Superset Card Title"
      loading={boolean('loading', false)}
      url="/superset/dashboard/births/"
      imgURL={text('imgURL', 'https://picsum.photos/800/600')}
      imgFallbackURL={select(
        imgFallbackKnob.label,
        imgFallbackKnob.options,
        imgFallbackKnob.defaultValue,
      )}
      description="Lorem ipsum dolor sit amet, consectetur adipiscing elit..."
      coverLeft="Left Section"
      coverRight="Right Section"
      actions={
        <ListViewCard.Actions>
          <FaveStar
            itemId={0}
            fetchFaveStar={action('fetchFaveStar')}
            saveFaveStar={action('saveFaveStar')}
            isStarred={boolean('isStarred', false)}
          />
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item
                  role="button"
                  tabIndex={0}
                  onClick={action('Delete')}
                >
                  <ListViewCard.MenuIcon name="trash" /> Delete
                </Menu.Item>
                <Menu.Item role="button" tabIndex={0} onClick={action('Edit')}>
                  <ListViewCard.MenuIcon name="pencil" /> Edit
                </Menu.Item>
              </Menu>
            }
          >
            <Icon name="more" />
          </Dropdown>
        </ListViewCard.Actions>
      }
    />
  );
};
