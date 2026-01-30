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
import { Meta, StoryObj } from '@storybook/react';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import ParetoChartPlugin from './ParetoChartPlugin';

const meta: Meta<typeof ParetoChartPlugin> = {
  title: 'Pareto Chart Plugin',
  component: ParetoChartPlugin,
  decorators: [
    (Story) => (
      <ThemeProvider theme={supersetTheme}>
        <div style={{ width: '100%', height: '600px' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  argTypes: {
    barColor: { control: 'color' },
    lineColor: { control: 'color' },
    thresholdValue: { control: { type: 'range', min: 0, max: 100, step: 5 } },
    showThresholdLine: { control: 'boolean' },
    showCumulativeLine: { control: 'boolean' },
    width: { control: { type: 'range', min: 400, max: 1200, step: 50 } },
    height: { control: { type: 'range', min: 300, max: 800, step: 50 } },
  },
};

export default meta;
type Story = StoryObj<typeof ParetoChartPlugin>;

// Default example with quality defects
export const DefectAnalysis: Story = {
  args: {
    width: 800,
    height: 600,
    boldText: true,
    headerFontSize: 'fontSizeLG',
    headerText: 'Quality Defects - Pareto Analysis',
    paretoData: [
      {
        category: 'Surface Scratches',
        value: 145,
        cumulativeValue: 145,
        cumulativePercent: 37.63,
      },
      {
        category: 'Misalignment',
        value: 89,
        cumulativeValue: 234,
        cumulativePercent: 60.73,
      },
      {
        category: 'Paint Bubbles',
        value: 67,
        cumulativeValue: 301,
        cumulativePercent: 78.13,
      },
      {
        category: 'Dents',
        value: 34,
        cumulativeValue: 335,
        cumulativePercent: 86.95,
      },
      {
        category: 'Color Mismatch',
        value: 21,
        cumulativeValue: 356,
        cumulativePercent: 92.4,
      },
      {
        category: 'Size Variation',
        value: 15,
        cumulativeValue: 371,
        cumulativePercent: 96.3,
      },
      {
        category: 'Missing Parts',
        value: 8,
        cumulativeValue: 379,
        cumulativePercent: 98.37,
      },
      { category: 'Other', value: 5, cumulativeValue: 384, cumulativePercent: 100.0 },
    ],
    data: [],
    categoryKey: 'category',
    valueKey: 'value',
    barColor: '#1f77b4',
    lineColor: '#ff7f0e',
    showThresholdLine: true,
    thresholdValue: 80,
    showCumulativeLine: true,
    xAxisLabel: 'Defect Type',
    yAxisLabel: 'Count',
    y2AxisLabel: 'Cumulative %',
  },
};

// Sales revenue example
export const CustomerRevenue: Story = {
  args: {
    ...DefectAnalysis.args,
    headerText: 'Top Customers by Revenue',
    paretoData: [
      { category: 'Acme Corp', value: 450000, cumulativeValue: 450000, cumulativePercent: 40.54 },
      {
        category: 'TechGlobal Inc',
        value: 320000,
        cumulativeValue: 770000,
        cumulativePercent: 69.37,
      },
      {
        category: 'Innovate LLC',
        value: 180000,
        cumulativeValue: 950000,
        cumulativePercent: 85.59,
      },
      {
        category: 'StartupX',
        value: 95000,
        cumulativeValue: 1045000,
        cumulativePercent: 94.14,
      },
      {
        category: 'SmallBiz Co',
        value: 45000,
        cumulativeValue: 1090000,
        cumulativePercent: 98.2,
      },
      {
        category: 'LocalShop',
        value: 20000,
        cumulativeValue: 1110000,
        cumulativePercent: 100.0,
      },
    ],
    xAxisLabel: 'Customer',
    yAxisLabel: 'Revenue ($)',
  },
};

// Custom colors
export const CustomColors: Story = {
  args: {
    ...DefectAnalysis.args,
    headerText: 'Custom Colored Pareto Chart',
    barColor: '#2ecc71',
    lineColor: '#e74c3c',
  },
};

// Without threshold line
export const NoThresholdLine: Story = {
  args: {
    ...DefectAnalysis.args,
    headerText: 'Pareto Chart - No Threshold Line',
    showThresholdLine: false,
  },
};

// Small dataset (3 items)
export const SmallDataset: Story = {
  args: {
    ...DefectAnalysis.args,
    headerText: 'Small Dataset - Top 3 Issues',
    paretoData: [
      { category: 'Issue A', value: 100, cumulativeValue: 100, cumulativePercent: 60.6 },
      { category: 'Issue B', value: 50, cumulativeValue: 150, cumulativePercent: 90.9 },
      { category: 'Issue C', value: 15, cumulativeValue: 165, cumulativePercent: 100.0 },
    ],
  },
};

// Large dataset
export const LargeDataset: Story = {
  args: {
    ...DefectAnalysis.args,
    headerText: 'Support Tickets by Category',
    paretoData: [
      { category: 'Password Reset', value: 234, cumulativeValue: 234, cumulativePercent: 33.62 },
      {
        category: 'Software Install',
        value: 156,
        cumulativeValue: 390,
        cumulativePercent: 56.03,
      },
      { category: 'Email Issues', value: 98, cumulativeValue: 488, cumulativePercent: 70.11 },
      { category: 'Network Issues', value: 87, cumulativeValue: 575, cumulativePercent: 82.61 },
      {
        category: 'Hardware Failure',
        value: 45,
        cumulativeValue: 620,
        cumulativePercent: 89.08,
      },
      { category: 'Printer Issues', value: 34, cumulativeValue: 654, cumulativePercent: 93.96 },
      { category: 'VPN Access', value: 23, cumulativeValue: 677, cumulativePercent: 97.27 },
      { category: 'Mobile Device', value: 12, cumulativeValue: 689, cumulativePercent: 98.99 },
      { category: 'Access Rights', value: 7, cumulativeValue: 696, cumulativePercent: 100.0 },
    ],
  },
};

// Empty state
export const EmptyState: Story = {
  args: {
    ...DefectAnalysis.args,
    headerText: 'No Data Available',
    paretoData: [],
  },
};

// Different threshold values
export const Threshold90: Story = {
  args: {
    ...DefectAnalysis.args,
    headerText: '90% Threshold',
    thresholdValue: 90,
  },
};

export const Threshold60: Story = {
  args: {
    ...DefectAnalysis.args,
    headerText: '60% Threshold',
    thresholdValue: 60,
  },
};

// No cumulative line
export const NoCumulativeLine: Story = {
  args: {
    ...DefectAnalysis.args,
    headerText: 'Bars Only - No Cumulative Line',
    showCumulativeLine: false,
    showThresholdLine: false,
  },
};

// Manufacturing downtime example
export const DowntimeAnalysis: Story = {
  args: {
    ...DefectAnalysis.args,
    headerText: 'Production Downtime by Cause',
    paretoData: [
      {
        category: 'Machine Breakdown',
        value: 156,
        cumulativeValue: 156,
        cumulativePercent: 37.86,
      },
      {
        category: 'Material Shortage',
        value: 89,
        cumulativeValue: 245,
        cumulativePercent: 59.47,
      },
      { category: 'Maintenance', value: 67, cumulativeValue: 312, cumulativePercent: 75.73 },
      { category: 'Power Outage', value: 34, cumulativeValue: 346, cumulativePercent: 83.98 },
      { category: 'Quality Issues', value: 28, cumulativeValue: 374, cumulativePercent: 90.78 },
      { category: 'Operator Error', value: 19, cumulativeValue: 393, cumulativePercent: 95.39 },
      { category: 'Software Glitch', value: 12, cumulativeValue: 405, cumulativePercent: 98.3 },
      { category: 'Other', value: 7, cumulativeValue: 412, cumulativePercent: 100.0 },
    ],
    xAxisLabel: 'Downtime Cause',
    yAxisLabel: 'Hours Lost',
  },
};
