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
 * Glyph Presets - Reusable argument configurations
 *
 * This module contains pre-configured arguments that are commonly
 * used across multiple visualization types. Charts can import these
 * directly or use .with() to customize them further.
 *
 * Example usage:
 * ```typescript
 * import { HeaderFontSize, Subtitle } from '../../glyph-core/presets';
 *
 * arguments: {
 *   headerFontSize: HeaderFontSize,
 *   subtitle: Subtitle,
 *   // Override defaults when needed:
 *   customSize: HeaderFontSize.with({ default: 0.5 }),
 * }
 * ```
 */

import { t } from '@apache-superset/core/translation';
import { Select, Text, Checkbox } from './arguments';
import { SelectOption } from './types';

// ============================================================================
// Font Size Options
// ============================================================================

/**
 * Large font size options - for primary/header text elements
 * Values are multipliers of container height (0.2 = 20% of height)
 */
export const FONT_SIZE_OPTIONS_LARGE: SelectOption[] = [
  { label: t('Tiny'), value: 0.2 },
  { label: t('Small'), value: 0.3 },
  { label: t('Normal'), value: 0.4 },
  { label: t('Large'), value: 0.5 },
  { label: t('Huge'), value: 0.6 },
];

/**
 * Small font size options - for secondary text elements (subtitles, labels)
 * Values are multipliers of container height
 */
export const FONT_SIZE_OPTIONS_SMALL: SelectOption[] = [
  { label: t('Tiny'), value: 0.125 },
  { label: t('Small'), value: 0.15 },
  { label: t('Normal'), value: 0.2 },
  { label: t('Large'), value: 0.3 },
  { label: t('Huge'), value: 0.4 },
];

// ============================================================================
// Pre-configured Arguments
// ============================================================================

/**
 * Header/primary font size selector
 * Used for main display elements like big numbers, titles
 */
export const HeaderFontSize = Select.with({
  label: t('Font Size'),
  description: t('Font size for the primary display element'),
  options: FONT_SIZE_OPTIONS_LARGE,
  default: 0.4,
});

/**
 * Subheader/secondary font size selector
 * Used for subtitles, labels, secondary text
 */
export const SubheaderFontSize = Select.with({
  label: t('Subheader Font Size'),
  description: t('Font size for secondary text elements'),
  options: FONT_SIZE_OPTIONS_SMALL,
  default: 0.15,
});

/**
 * Subtitle text input
 * Generic subtitle/description field used by many chart types
 */
export const Subtitle = Text.with({
  label: t('Subtitle'),
  description: t('Description text displayed below the main content'),
  default: '',
});

/**
 * Show legend toggle
 * Common toggle for charts with legends
 */
export const ShowLegend = Checkbox.with({
  // Strings match plugin-chart-echarts' legend controls so existing i18n
  // catalogs apply and legend UX stays consistent across chart families.
  label: t('Show legend'),
  description: t('Whether to display a legend for the chart'),
  default: true,
});

/**
 * Force timestamp formatting toggle
 * Used when a value might be a timestamp but isn't auto-detected
 */
export const ForceTimestampFormatting = Checkbox.with({
  label: t('Force Date Format'),
  description: t(
    'Use date formatting even when the value is not detected as a timestamp',
  ),
  default: false,
});

// ============================================================================
// Legend Options
// ============================================================================

export const LEGEND_TYPE_OPTIONS: SelectOption[] = [
  { label: t('Scroll'), value: 'scroll' },
  { label: t('List'), value: 'plain' },
];

export const LEGEND_ORIENTATION_OPTIONS: SelectOption[] = [
  { label: t('Top'), value: 'top' },
  { label: t('Bottom'), value: 'bottom' },
  { label: t('Left'), value: 'left' },
  { label: t('Right'), value: 'right' },
];

export const LEGEND_SORT_OPTIONS: SelectOption[] = [
  { label: t('No sort'), value: '' },
  { label: t('Ascending'), value: 'asc' },
  { label: t('Descending'), value: 'desc' },
];

/**
 * Legend type selector
 * Choose between scrollable or plain list legend
 */
export const LegendType = Select.with({
  label: t('Type'),
  description: t('Legend type'),
  options: LEGEND_TYPE_OPTIONS,
  default: 'scroll',
});

/**
 * Legend orientation selector
 * Position the legend relative to the chart
 */
export const LegendOrientation = Select.with({
  label: t('Orientation'),
  description: t('Legend Orientation'),
  options: LEGEND_ORIENTATION_OPTIONS,
  default: 'top',
});

/**
 * Legend sort selector
 * Sort legend items alphabetically
 */
export const LegendSort = Select.with({
  label: t('Legend Sort'),
  description: t('Sort order for legend items'),
  options: LEGEND_SORT_OPTIONS,
  default: '',
});

// ============================================================================
// Label Presets
// ============================================================================

/**
 * Show labels toggle
 * Common toggle for chart labels
 */
export const ShowLabels = Checkbox.with({
  label: t('Show Labels'),
  description: t('Whether to display labels on the chart'),
  default: true,
});

/**
 * Show value toggle
 * Common toggle for showing values on chart elements
 */
export const ShowValue = Checkbox.with({
  label: t('Show Value'),
  description: t('Whether to display values on the chart'),
  default: false,
});

// ============================================================================
// Metric Name Presets
// ============================================================================

/**
 * Show metric name toggle
 * Used in BigNumber charts to optionally show the metric name
 */
export const ShowMetricName = Checkbox.with({
  label: t('Show Metric Name'),
  description: t('Whether to display the metric name as a title'),
  default: false,
});

/**
 * Metric name font size selector
 * Typically used with visibility tied to ShowMetricName
 */
export const MetricNameFontSize = Select.with({
  label: t('Metric Name Font Size'),
  description: t('Font size for the metric name'),
  options: FONT_SIZE_OPTIONS_SMALL,
  default: 0.15,
});

// ============================================================================
// Label Type Options (shared by Pie, Funnel, etc.)
// ============================================================================

/**
 * Standard label content type options
 * Used by Pie, Funnel, and other category-based charts
 */
export const LABEL_TYPE_OPTIONS: SelectOption[] = [
  { label: t('Category Name'), value: 'key' },
  { label: t('Value'), value: 'value' },
  { label: t('Percentage'), value: 'percent' },
  { label: t('Category and Value'), value: 'key_value' },
  { label: t('Category and Percentage'), value: 'key_percent' },
  { label: t('Category, Value and Percentage'), value: 'key_value_percent' },
  { label: t('Value and Percentage'), value: 'value_percent' },
];

/**
 * Label type selector for category-based charts
 */
export const LabelType = Select.with({
  label: t('Label Type'),
  description: t('What should be shown on the label?'),
  options: LABEL_TYPE_OPTIONS,
  default: 'key',
});

// ============================================================================
// Sort Options
// ============================================================================

export const SORT_OPTIONS: SelectOption[] = [
  { label: t('Descending'), value: 'descending' },
  { label: t('Ascending'), value: 'ascending' },
  { label: t('None'), value: 'none' },
];

/**
 * Sort by metric toggle
 * Common for charts that need to sort data by metric value
 */
export const SortByMetric = Checkbox.with({
  label: t('Sort by Metric'),
  description: t('Sort results by the selected metric'),
  default: true,
});

// ============================================================================
// Label Position Options
// ============================================================================

export const LABEL_POSITION_OPTIONS: SelectOption[] = [
  { label: t('Top'), value: 'top' },
  { label: t('Left'), value: 'left' },
  { label: t('Right'), value: 'right' },
  { label: t('Bottom'), value: 'bottom' },
  { label: t('Inside'), value: 'inside' },
  { label: t('Inside Left'), value: 'insideLeft' },
  { label: t('Inside Right'), value: 'insideRight' },
  { label: t('Inside Top'), value: 'insideTop' },
  { label: t('Inside Bottom'), value: 'insideBottom' },
];

/**
 * Label position selector
 * Position labels relative to chart elements
 */
export const LabelPosition = Select.with({
  label: t('Label Position'),
  description: t('Position of labels on the chart'),
  options: LABEL_POSITION_OPTIONS,
  default: 'top',
});

// ============================================================================
// Simple Label Type (key/value variants only)
// ============================================================================

/**
 * Simple label type options - for charts with fewer label display options
 * Used by Radar, Sunburst, etc.
 */
export const SIMPLE_LABEL_TYPE_OPTIONS: SelectOption[] = [
  { label: t('Category Name'), value: 'key' },
  { label: t('Value'), value: 'value' },
  { label: t('Category and Value'), value: 'key_value' },
];

/**
 * Simple label type selector
 * For charts that only need key/value/key_value options
 */
export const SimpleLabelType = Select.with({
  label: t('Label Type'),
  description: t('What should be shown on the label?'),
  options: SIMPLE_LABEL_TYPE_OPTIONS,
  default: 'key',
});

/**
 * Value-only label type options - for charts like Radar
 */
export const VALUE_LABEL_TYPE_OPTIONS: SelectOption[] = [
  { label: t('Value'), value: 'value' },
  { label: t('Category and Value'), value: 'key_value' },
];

/**
 * Value label type selector
 * For charts that show value or category+value
 */
export const ValueLabelType = Select.with({
  label: t('Label Type'),
  description: t('What should be shown on the label?'),
  options: VALUE_LABEL_TYPE_OPTIONS,
  default: 'value',
});

// ============================================================================
// Totals and Aggregates
// ============================================================================

/**
 * Show total toggle
 * For charts that can display aggregate totals
 */
export const ShowTotal = Checkbox.with({
  label: t('Show Total'),
  description: t('Whether to display the aggregate total'),
  default: false,
});

// ============================================================================
// Threshold Controls
// ============================================================================

/**
 * Label percentage threshold
 * Minimum percentage for showing labels (avoids clutter on small slices)
 */
export const LabelThreshold = Text.with({
  label: t('Percentage Threshold'),
  description: t('Minimum threshold in percentage points for showing labels'),
  default: '5',
});

// ============================================================================
// Shape Options
// ============================================================================

/**
 * Circle shape toggle (used by Radar)
 */
export const CircleShape = Checkbox.with({
  label: t('Circle Shape'),
  description: t('Use circular shape instead of polygon'),
  default: false,
});

// ============================================================================
// Data Zoom
// ============================================================================

/**
 * Enable data zoom toggle
 * For charts with zoomable data areas
 */
export const DataZoom = Checkbox.with({
  label: t('Data Zoom'),
  description: t('Enable data zooming controls'),
  default: false,
});
