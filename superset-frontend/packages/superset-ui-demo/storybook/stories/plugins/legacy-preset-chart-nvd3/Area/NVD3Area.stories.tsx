/*
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

import { AreaChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';

new AreaChartPlugin().configure({ key: 'area' }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-preset-chart-nvd3/Area',
};

export { stacked } from './stories/stacked';
export {
  stackedWithYAxisBounds,
  stackedWithYAxisBoundsMinOnly,
} from './stories/stackedWithBounds';
export { expanded } from './stories/expanded';
export { controlsShown } from './stories/controlsShown';
