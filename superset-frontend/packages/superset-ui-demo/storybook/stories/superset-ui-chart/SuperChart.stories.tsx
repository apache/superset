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

export const Basic = ({ width, height }: { width: string; height: string }) => (
  <SuperChart
    chartType={ChartKeys.DILIGENT}
    width={width}
    height={height}
    queriesData={[DEFAULT_QUERY_DATA]}
    formData={{ hi: 1 }}
  />
);
Basic.args = {
  width: '100%',
  height: '100%',
};
Basic.argTypes = {
  width: { control: 'text', description: 'Vis width' },
  height: { control: 'text', description: 'Vis height' },
};

export const Container50pct = ({
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

Container50pct.storyName = '50% of container';
Container50pct.args = {
  width: '50%',
  height: '50%',
};
Container50pct.argTypes = {
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

export const FixedWidth100height = ({
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

FixedWidth100height.storyName = 'fixed width, 100% height';
FixedWidth100height.args = {
  width: '500',
  height: '100%',
};
FixedWidth100height.argTypes = {
  width: { control: 'text', description: 'Vis width' },
  height: { control: 'text', description: 'Vis height' },
};

export const FixedHeight100Width = ({
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
FixedHeight100Width.storyName = 'fixed height, 100% width';
FixedHeight100Width.args = {
  width: '100%',
  height: '300',
};
FixedHeight100Width.argTypes = {
  width: { control: 'text', description: 'Vis width' },
  height: { control: 'text', description: 'Vis height' },
};

export const WithErrorBoundary = ({
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
// The story name is automatically generated from the export name
WithErrorBoundary.args = {
  width: '500',
  height: '300',
};
WithErrorBoundary.argTypes = {
  width: { control: 'text', description: 'Vis width' },
  height: { control: 'text', description: 'Vis height' },
};

export const WithWrapper = ({
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
// The story name is automatically generated from the export name
WithWrapper.args = {
  width: '100%',
  height: '100%',
};
WithWrapper.argTypes = {
  width: { control: 'text', description: 'Vis width' },
  height: { control: 'text', description: 'Vis height' },
};

export const WithNoResults = ({
  width,
  height,
}: {
  width: string;
  height: string;
}) => (
  <SuperChart chartType={ChartKeys.DILIGENT} width={width} height={height} />
);
WithNoResults.storyName = 'With no results';
WithNoResults.args = {
  width: '100%',
  height: '100%',
};
WithNoResults.argTypes = {
  width: { control: 'text', description: 'Vis width' },
  height: { control: 'text', description: 'Vis height' },
};

export const WithNoResultsAndMedium = ({
  width,
  height,
}: {
  width: string;
  height: string;
}) => (
  <SuperChart chartType={ChartKeys.DILIGENT} width={width} height={height} />
);

WithNoResultsAndMedium.storyName = 'With no results and medium';
WithNoResultsAndMedium.args = {
  width: '400',
  height: '300',
};
WithNoResultsAndMedium.argTypes = {
  width: { control: 'text', description: 'Vis width' },
  height: { control: 'text', description: 'Vis height' },
};

export const WithNoResultsAndSmall = ({
  width,
  height,
}: {
  width: string;
  height: string;
}) => (
  <SuperChart chartType={ChartKeys.DILIGENT} width={width} height={height} />
);
WithNoResultsAndSmall.storyName = 'With no results and small';
WithNoResultsAndSmall.args = {
  width: '150',
  height: '200',
};
WithNoResultsAndSmall.argTypes = {
  width: { control: 'text', description: 'Vis width' },
  height: { control: 'text', description: 'Vis height' },
};
