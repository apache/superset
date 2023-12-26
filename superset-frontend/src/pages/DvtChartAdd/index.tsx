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
import withToasts from 'src/components/MessageToasts/withToasts';
import {
  StyledChart,
  StyledChartAdd,
  StyledImgRender,
} from './dvt-chart-add.module';

const photoFileNames = [
  { label: 'Lorem Ipsum Dolor Sit', fileName: 'area.png' },
  { label: 'Lorem Ipsum Dolor Sit', fileName: 'bar.png' },
  { label: 'Lorem Ipsum Dolor Sit', fileName: 'big_number_total.png' },
  { label: 'Lorem Ipsum Dolor Sit', fileName: 'big_number.png' },
  { label: 'Lorem Ipsum Dolor Sit', fileName: 'box_plot.png' },
  { label: 'Lorem Ipsum Dolor Sit', fileName: 'bubble.png' },
  { label: 'Lorem Ipsum Dolor Sit', fileName: 'bullet.png' },
  { label: 'Lorem Ipsum Dolor Sit', fileName: 'cal_heatmap.png' },
  { label: 'Lorem Ipsum Dolor Sit', fileName: 'chord.png' },
  { label: 'Lorem Ipsum Dolor Sit', fileName: 'compare.png' },
  { label: 'Lorem Ipsum Dolor Sit', fileName: 'country_map.png' },
  { label: 'Lorem Ipsum Dolor Sit', fileName: 'deck_arc.png' },
  { label: 'Lorem Ipsum Dolor Sit', fileName: 'deck_grid.png' },
];

class ChartAdd extends React.Component {
  renderPhotos = () => {
    return photoFileNames.map((item, index) => {
      const imgSrc = require(`../../../src/assets/images/viz_thumbnails/${item.fileName}`);
      const imgAlt = `Photo ${index + 1}`;
      return (
        <StyledImgRender>
          {item.label}
          <img key={index} src={imgSrc} alt={imgAlt} />
        </StyledImgRender>
      );
    });
  };

  render() {
    return (
      <StyledChartAdd>
        <StyledChart>{this.renderPhotos()}</StyledChart>
      </StyledChartAdd>
    );
  }
}

export default withToasts(ChartAdd);
