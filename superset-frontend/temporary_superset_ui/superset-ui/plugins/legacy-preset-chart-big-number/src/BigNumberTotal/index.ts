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
import { t, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import controlPanel from './controlPanel';
import transformProps, {
  BigNumberChartProps,
  BigNumberFormData,
} from '../BigNumber/transformProps';
import example1 from './images/BigNumber.jpg';
import example2 from './images/BigNumber2.jpg';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  category: t('KPI'),
  description: t(
    'Showcases a single metric front-and-center. Big number is best used to call attention to a KPI or the one thing you want your audience to focus on.',
  ),
  exampleGallery: [
    { url: example1, caption: t('A Big Number') },
    { url: example2, caption: t('With a subheader') },
  ],
  name: t('Big Number'),
  tags: [
    t('Additive'),
    t('Business'),
    t('Formattable'),
    t('Legacy'),
    t('Percentages'),
    t('Highly-used'),
    t('Report'),
    t('Text'),
  ],
  thumbnail,
  useLegacyApi: true,
});

export default class BigNumberTotalChartPlugin extends ChartPlugin<
  BigNumberFormData,
  BigNumberChartProps
> {
  constructor() {
    super({
      loadChart: () => import('../BigNumber/BigNumber'),
      metadata,
      transformProps,
      controlPanel,
    });
  }
}
