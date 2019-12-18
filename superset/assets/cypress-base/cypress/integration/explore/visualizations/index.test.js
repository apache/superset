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
import AreaTest from './area';
import BigNumberTest from './big_number';
import BigNumberTotalTest from './big_number_total';
import BubbleTest from './bubble';
import CompareTest from './compare';
import DistBarTest from './dist_bar';
import DualLineTest from './dual_line';
import FilterBox from './filter_box';
import HistogramTest from './histogram';
import LineTest from './line';
import PieTest from './pie';
import PivotTableTest from './pivot_table';
import SankeyTest from './sankey';
import SunburstTest from './sunburst';
import TableTest from './table';
import TimeTableTest from './time_table';
import TreemapTest from './treemap';
import WorldMapTest from './world_map';

describe('All Visualizations', () => {
  AreaTest();
  BigNumberTest();
  BigNumberTotalTest();
  BubbleTest();
  CompareTest();
  DistBarTest();
  DualLineTest();
  FilterBox();
  HistogramTest();
  LineTest();
  PieTest();
  PivotTableTest();
  SankeyTest();
  SunburstTest();
  TableTest();
  TimeTableTest();
  TreemapTest();
  WorldMapTest();
});
