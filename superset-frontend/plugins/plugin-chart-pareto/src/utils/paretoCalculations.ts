import { TimeseriesDataRecord } from '@superset-ui/core';

/**
 * Represents a single data point in a Pareto chart.
 */
export interface ParetoDataPoint {
  /** The category or label for the data point */
  category: string;

  /** The raw value associated with the category */
  value: number;

  /** The cumulative total value up to and including this point */
  cumulativeValue: number;

  /** The cumulative percentage of the total represented by this point */
  cumulativePercent: number;
}

/**
 * Transforms raw timeseries data into a sorted dataset suitable for a Pareto chart.
 *
 * A Pareto chart combines a bar chart (showing individual values in descending order)
 * with a line chart (showing cumulative percentage). This function prepares the data
 * for that purpose by:
 *
 * 1. Sorting the input data by value in descending order.
 * 2. Calculating the cumulative value and cumulative percentage for each item.
 * 3. Returning an array of `ParetoDataPoint` objects.
 *
 * @param data - The raw timeseries data records (usually coming from Superset).
 * @param categoryKey - The key used to extract the category name from each record.
 * @param valueKey - The key used to extract the numeric value from each record.
 *
 * @returns An array of `ParetoDataPoint` objects sorted in descending order by value,
 *          with cumulative value and percentage calculated for each.
 */
export function calculateParetoData(
  data: TimeseriesDataRecord[],
  categoryKey: string,
  valueKey: string,
): ParetoDataPoint[] {
  // 1. Sort descending by value
  const sorted = [...data].sort((a, b) => Number(b[valueKey]) - Number(a[valueKey]));

  // 2. Calculate total
  const total = sorted.reduce((sum, item) => sum + Number(item[valueKey]), 0);

  // 3. Calculate cumulative percentages
  let cumulative = 0;
  return sorted.map((item) => {
    const itemValue = Number(item[valueKey]) || 0; // Handles NaN
    cumulative += itemValue;
    return {
      category: String(item[categoryKey] ?? ''), // Handles null/undefined
      value: itemValue,
      cumulativeValue: cumulative,
      cumulativePercent: total > 0 ? (cumulative / total) * 100 : 0,
    };
  });
}
