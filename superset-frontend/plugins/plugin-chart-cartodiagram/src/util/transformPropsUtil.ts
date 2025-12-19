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

import {
  ChartProps,
  convertKeysToCamelCase,
  DataRecord,
} from '@superset-ui/core';
import { isObject } from 'lodash';
import {
  LocationConfigMapping,
  SelectedChartConfig,
  ChartConfig,
  ChartConfigFeature,
} from '../types';

const COLUMN_SEPARATOR = ', ';

/**
 * Get the indices of columns where the title is a geojson.
 *
 * @param columns List of column names.
 * @returns List of indices containing geojsonColumns.
 */
export const getGeojsonColumns = (columns: string[]) =>
  columns.reduce((prev, current, idx) => {
    let parsedColName;
    try {
      parsedColName = JSON.parse(current);
    } catch {
      parsedColName = undefined;
    }
    if (!parsedColName || !isObject(parsedColName)) {
      return [...prev];
    }
    if (!('type' in parsedColName) || !('coordinates' in parsedColName)) {
      return [...prev];
    }
    return [...prev, idx];
  }, []);

/**
 * Create a column name ignoring provided indices.
 *
 * @param columns List of column names.
 * @param ignoreIdx List of indices to ignore.
 * @returns Column name.
 */
export const createColumnName = (columns: string[], ignoreIdx: number[]) =>
  columns.filter((l, idx) => !ignoreIdx.includes(idx)).join(COLUMN_SEPARATOR);

/**
 * Group data by location for data providing a generic
 * x-axis.
 *
 * @param data The data to group.
 * @param params The data params.
 * @returns Data grouped by location.
 */
export const groupByLocationGenericX = (
  data: DataRecord[],
  params: SelectedChartConfig['params'],
  queryData: any,
) => {
  const locations: LocationConfigMapping = {};
  if (!data) {
    return locations;
  }
  data.forEach(d => {
    Object.keys(d)
      .filter(k => k !== params.x_axis)
      .forEach(k => {
        const labelMap: string[] = queryData.label_map?.[k];

        if (!labelMap) {
          console.log(
            'Cannot extract location from queryData. label_map not defined',
          );
          return;
        }

        const geojsonCols = getGeojsonColumns(labelMap);

        if (geojsonCols.length > 1) {
          // TODO what should we do, if there is more than one geom column?
          console.log(
            'More than one geometry column detected. Using first found.',
          );
        }
        const location = labelMap[geojsonCols[0]];
        const filter = geojsonCols.length ? [geojsonCols[0]] : [];
        const leftOverKey = createColumnName(labelMap, filter);

        if (!Object.keys(locations).includes(location)) {
          locations[location] = [];
        }

        let dataAtX = locations[location].find(
          i => i[params.x_axis] === d[params.x_axis],
        );

        if (!dataAtX) {
          dataAtX = {
            // add the x_axis value explicitly, since we
            // filtered it out for the rest of the computation.
            [params.x_axis]: d[params.x_axis],
          };
          locations[location].push(dataAtX);
        }
        dataAtX[leftOverKey] = d[k];
      });
  });

  return locations;
};

/**
 * Group data by location.
 *
 * @param data The incoming dataset
 * @param geomColumn The name of the geometry column
 * @returns The grouped data
 */
export const groupByLocation = (data: DataRecord[], geomColumn: string) => {
  const locations: LocationConfigMapping = {};

  data.forEach(d => {
    const loc = d[geomColumn] as string;
    if (!loc) {
      return;
    }

    if (!Object.keys(locations).includes(loc)) {
      locations[loc] = [];
    }

    const newData = {
      ...d,
    };
    delete newData[geomColumn];

    locations[loc].push(newData);
  });

  return locations;
};

/**
 * Strips the geom from colnames and coltypes.
 *
 * @param queryData The querydata.
 * @param geomColumn Name of the geom column.
 * @returns colnames and coltypes without the geom.
 */
export const stripGeomFromColnamesAndTypes = (
  queryData: any,
  geomColumn: string,
) => {
  const newColnames: string[] = [];
  const newColtypes: number[] = [];
  queryData.colnames?.forEach((colname: string, idx: number) => {
    if (colname === geomColumn) {
      return;
    }

    const parts = colname.split(COLUMN_SEPARATOR);
    const geojsonColumns = getGeojsonColumns(parts);
    const filter = geojsonColumns.length ? [geojsonColumns[0]] : [];

    const newColname = createColumnName(parts, filter);
    if (newColnames.includes(newColname)) {
      return;
    }
    newColnames.push(newColname);
    newColtypes.push(queryData.coltypes[idx]);
  });

  return {
    colnames: newColnames,
    coltypes: newColtypes,
  };
};

/**
 * Strips the geom from labelMap.
 *
 * @param queryData The querydata.
 * @param geomColumn Name of the geom column.
 * @returns labelMap without the geom column.
 */
export const stripGeomColumnFromLabelMap = (
  labelMap: { [key: string]: string[] },
  geomColumn: string,
) => {
  const newLabelMap: Record<string, string[]> = {};
  Object.entries(labelMap).forEach(([key, value]) => {
    if (key === geomColumn) {
      return;
    }
    const geojsonCols = getGeojsonColumns(value);
    const filter = geojsonCols.length ? [geojsonCols[0]] : [];
    const columnName = createColumnName(value, filter);
    const restItems = value.filter((v, idx) => !geojsonCols.includes(idx));
    newLabelMap[columnName] = restItems;
  });
  return newLabelMap;
};

/**
 * Strip occurrences of the geom column from the query data.
 *
 * @param queryDataClone The query data
 * @param geomColumn The name of the geom column
 * @returns query data without geom column.
 */
export const stripGeomColumnFromQueryData = (
  queryData: any,
  geomColumn: string,
) => {
  const queryDataClone = {
    ...structuredClone(queryData),
    ...stripGeomFromColnamesAndTypes(queryData, geomColumn),
  };
  if (queryDataClone.label_map) {
    queryDataClone.label_map = stripGeomColumnFromLabelMap(
      queryData.label_map,
      geomColumn,
    );
  }
  return queryDataClone;
};

/**
 * Create the chart configurations depending on the referenced Superset chart.
 *
 * @param selectedChart The configuration of the referenced Superset chart
 * @param geomColumn The name of the geometry column
 * @param chartProps The properties provided within this OL plugin
 * @param chartTransformer The transformer function
 * @returns The chart configurations
 */
export const getChartConfigs = (
  selectedChart: SelectedChartConfig,
  geomColumn: string,
  chartProps: ChartProps,
  chartTransformer: any,
) => {
  const chartFormDataSnake = selectedChart.params;
  const chartFormData = convertKeysToCamelCase(chartFormDataSnake);

  const baseConfig = {
    ...chartProps,
    // We overwrite width and height, which are not needed
    // here, but leads to unnecessary updating of the UI.
    width: null,
    height: null,
    formData: chartFormData,
    rawFormData: chartFormDataSnake,
    datasource: {},
  };

  const { queriesData } = chartProps;
  const [queryData] = queriesData;

  const data = queryData.data as DataRecord[];
  let dataByLocation: LocationConfigMapping;

  const chartConfigs: ChartConfig = {
    type: 'FeatureCollection',
    features: [],
  };

  if (!data) {
    return chartConfigs;
  }

  if ('x_axis' in selectedChart.params) {
    dataByLocation = groupByLocationGenericX(
      data,
      selectedChart.params,
      queryData,
    );
  } else {
    dataByLocation = groupByLocation(data, geomColumn);
  }

  const strippedQueryData = stripGeomColumnFromQueryData(queryData, geomColumn);

  Object.keys(dataByLocation).forEach(location => {
    const config = {
      ...baseConfig,
      queriesData: [
        {
          ...strippedQueryData,
          data: dataByLocation[location],
        },
      ],
    };
    const transformedProps = chartTransformer(config);

    const feature: ChartConfigFeature = {
      type: 'Feature',
      geometry: JSON.parse(location),
      properties: {
        ...transformedProps,
      },
    };

    chartConfigs.features.push(feature);
  });
  return chartConfigs;
};

/**
 * Return the same chart configuration with parsed values for of the stringified "params" object.
 *
 * @param selectedChart Incoming chart configuration
 * @returns Chart configuration with parsed values for "params"
 */
export const parseSelectedChart = (selectedChart: string) => {
  const selectedChartParsed = JSON.parse(selectedChart);
  selectedChartParsed.params = JSON.parse(selectedChartParsed.params);
  return selectedChartParsed;
};
