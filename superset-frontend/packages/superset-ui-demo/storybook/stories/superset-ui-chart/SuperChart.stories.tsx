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

import { SuperChart } from '@superset-ui/core';
import {
  DiligentChartPlugin,
  BuggyChartPlugin,
  ChartKeys,
} from '../../../../superset-ui-core/test/chart/components/MockChartPlugins';
import ResizableChartDemo from '../../shared/components/ResizableChartDemo';

new DiligentChartPlugin().configure({ key: ChartKeys.DILIGENT }).register();
new BuggyChartPlugin().configure({ key: ChartKeys.BUGGY }).register();

const DEFAULT_QUERY_DATA = { data: ['foo', 'bar'] };

export default {
  title: 'Others/SuperChart',
  decorators: [],
};

export const basic = ({ width, height }: { width: string; height: string }) => (
  <SuperChart
    chartType={ChartKeys.DILIGENT}
    width={width}
    height={height}
    queriesData={[DEFAULT_QUERY_DATA]}
    formData={{ hi: 1 }}
  />
);
basic.args = {
  width: '100%',
  height: '100%',
};
basic.argTypes = {
  width: { control: 'text', description: 'Vis width' },
  height: { control: 'text', description: 'Vis height' },
};

export const container50pct = ({
  width,
  height,
}: {
  width: string;
  height: string;
}) => (
  <SuperChart
    chartType={ChartKeys.DILIGENT}
    width={width}
    height={height}
    queriesData={[DEFAULT_QUERY_DATA]}
    formData={{ hi: 1 }}
  />
);

container50pct.storyName = '50% of container';
container50pct.args = {
  width: '50%',
  height: '50%',
};
container50pct.argTypes = {
  width: { control: 'text', description: 'Vis width' },
  height: { control: 'text', description: 'Vis height' },
};

export const Resizable = () => (
  <ResizableChartDemo>
    {size => (
      <SuperChart
        chartType={ChartKeys.DILIGENT}
        width={size.width}
        height={size.height}
        queriesData={[DEFAULT_QUERY_DATA]}
      />
    )}
  </ResizableChartDemo>
);

export const fixedWidth100height = ({
  width,
  height,
}: {
  width: string;
  height: string;
}) => (
  <SuperChart
    chartType={ChartKeys.DILIGENT}
    height={height}
    width={width}
    queriesData={[DEFAULT_QUERY_DATA]}
  />
);

fixedWidth100height.storyName = 'fixed width, 100% height';
fixedWidth100height.args = {
  width: '500',
  height: '100%',
};
fixedWidth100height.argTypes = {
  width: { control: 'text', description: 'Vis width' },
  height: { control: 'text', description: 'Vis height' },
};

export const fixedHeight100Width = ({
  width,
  height,
}: {
  width: string;
  height: string;
}) => (
  <SuperChart
    chartType={ChartKeys.DILIGENT}
    height={height}
    width={width}
    queriesData={[DEFAULT_QUERY_DATA]}
  />
);
fixedHeight100Width.storyName = 'fixed height, 100% width';
fixedHeight100Width.args = {
  width: '100%',
  height: '300',
};
fixedHeight100Width.argTypes = {
  width: { control: 'text', description: 'Vis width' },
  height: { control: 'text', description: 'Vis height' },
};

export const withErrorBoundary = ({
  width,
  height,
}: {
  width: string;
  height: string;
}) => (
  <SuperChart
    chartType={ChartKeys.BUGGY}
    height={height}
    width={width}
    queriesData={[DEFAULT_QUERY_DATA]}
  />
);
withErrorBoundary.storyName = 'With Error Boundary';
withErrorBoundary.args = {
  width: '500',
  height: '300',
};
withErrorBoundary.argTypes = {
  width: { control: 'text', description: 'Vis width' },
  height: { control: 'text', description: 'Vis height' },
};

export const withWrapper = ({
  width,
  height,
}: {
  width: string;
  height: string;
}) => (
  <SuperChart
    chartType={ChartKeys.DILIGENT}
    width={width}
    height={height}
    queriesData={[DEFAULT_QUERY_DATA]}
    Wrapper={({ children }) => (
      <div>
        <div style={{ margin: 10, position: 'fixed' }}>With wrapper!</div>
        {children}
      </div>
    )}
  />
);
withWrapper.storyName = 'With Wrapper';
withWrapper.args = {
  width: '100%',
  height: '100%',
};
withWrapper.argTypes = {
  width: { control: 'text', description: 'Vis width' },
  height: { control: 'text', description: 'Vis height' },
};

export const withNoResults = ({
  width,
  height,
}: {
  width: string;
  height: string;
}) => (
  <SuperChart chartType={ChartKeys.DILIGENT} width={width} height={height} />
);
withNoResults.storyName = 'With no results';
withNoResults.args = {
  width: '100%',
  height: '100%',
};
withNoResults.argTypes = {
  width: { control: 'text', description: 'Vis width' },
  height: { control: 'text', description: 'Vis height' },
};

export const withNoResultsAndMedium = ({
  width,
  height,
}: {
  width: string;
  height: string;
}) => (
  <SuperChart chartType={ChartKeys.DILIGENT} width={width} height={height} />
);

withNoResultsAndMedium.storyName = 'With no results and medium';
withNoResultsAndMedium.args = {
  width: '400',
  height: '300',
};
withNoResultsAndMedium.argTypes = {
  width: { control: 'text', description: 'Vis width' },
  height: { control: 'text', description: 'Vis height' },
};

export const withNoResultsAndSmall = ({
  width,
  height,
}: {
  width: string;
  height: string;
}) => (
  <SuperChart chartType={ChartKeys.DILIGENT} width={width} height={height} />
);
withNoResultsAndSmall.storyName = 'With no results and small';
withNoResultsAndSmall.args = {
  width: '150',
  height: '200',
};
withNoResultsAndSmall.argTypes = {
  width: { control: 'text', description: 'Vis width' },
  height: { control: 'text', description: 'Vis height' },
};
