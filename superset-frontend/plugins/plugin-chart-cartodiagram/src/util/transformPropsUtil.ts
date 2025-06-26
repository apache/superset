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
  CategoricalColorNamespace,
  ChartDataResponseResult,
  ChartProps,
  convertKeysToCamelCase,
  DataRecord,
  DataRecordValue,
  ensureIsArray,
  GenericDataType,
  getColumnLabel,
  getTimeFormatter,
  normalizeTimestamp,
  NumberFormatter,
  TimeFormatter,
  ValueFormatter,
} from '@superset-ui/core';
import { isObject } from 'lodash';
import WKB from 'ol/format/WKB';
import {
  LocationConfigMapping,
  SelectedChartConfig,
  ChartConfig,
  ChartConfigFeature,
} from '../types';
import { GeometryFormat, NULL_STRING } from '../constants';
import { wkbToGeoJSON, wktToGeoJSON } from './mapUtil';

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

export const getWkbColumns = (columns: string[]) =>
  columns.reduce((prev, current, idx) => {
    let isWkb;

    try {
      new WKB().readFeature(current);
      isWkb = true;
    } catch {
      isWkb = false;
    }
    if (!isWkb) {
      return [...prev];
    }
    return [...prev, idx];
  }, []);

const WktFormatIdentifiers = [
  'SRID=',
  'POINT',
  'LINESTRING',
  'POLYGON',
  'MULTIPOINT',
  'MULTILINESTRING',
  'MULTIPOLYGON',
];
export const getWktColumns = (columns: string[]) =>
  columns.reduce((prev, current, idx) => {
    const isWkt = WktFormatIdentifiers.some(identifier =>
      current.startsWith(identifier),
    );
    if (!isWkt) {
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
  geomFormat: GeometryFormat,
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

        let geomColumns: number[];

        if (geomFormat === GeometryFormat.GEOJSON) {
          geomColumns = getGeojsonColumns(labelMap);
        } else if (geomFormat === GeometryFormat.WKB) {
          geomColumns = getWkbColumns(labelMap);
        } else {
          geomColumns = getWktColumns(labelMap);
        }

        if (geomColumns.length > 1) {
          // TODO what should we do, if there is more than one geom column?
          console.log(
            'More than one geometry column detected. Using first found.',
          );
        }
        const location = labelMap[geomColumns[0]];
        const filter = geomColumns.length ? [geomColumns[0]] : [];
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
  geomFormat: GeometryFormat,
) => {
  const newColnames: string[] = [];
  const newColtypes: number[] = [];
  queryData.colnames?.forEach((colname: string, idx: number) => {
    if (colname === geomColumn) {
      return;
    }

    const parts = colname.split(COLUMN_SEPARATOR);
    let geomColumns: number[];

    if (geomFormat === GeometryFormat.GEOJSON) {
      geomColumns = getGeojsonColumns(parts);
    } else if (geomFormat === GeometryFormat.WKB) {
      geomColumns = getWkbColumns(parts);
    } else {
      geomColumns = getWktColumns(parts);
    }
    const filter = geomColumns.length ? [geomColumns[0]] : [];

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
 * @param geomFormat The format of the geometries.
 * @returns labelMap without the geom column.
 */
export const stripGeomColumnFromLabelMap = (
  labelMap: { [key: string]: string[] },
  geomColumn: string,
  geomFormat: GeometryFormat,
) => {
  const newLabelMap: Record<string, string[]> = {};
  Object.entries(labelMap).forEach(([key, value]) => {
    if (key === geomColumn) {
      return;
    }
    let geomColumns: number[];
    if (geomFormat === GeometryFormat.GEOJSON) {
      geomColumns = getGeojsonColumns(value);
    } else if (geomFormat === GeometryFormat.WKB) {
      geomColumns = getWkbColumns(value);
    } else {
      geomColumns = getWktColumns(value);
    }
    const filter = geomColumns.length ? [geomColumns[0]] : [];
    const columnName = createColumnName(value, filter);
    const restItems = value.filter((v, idx) => !geomColumns.includes(idx));
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
  geomFormat: GeometryFormat,
) => {
  const queryDataClone = {
    ...structuredClone(queryData),
    ...stripGeomFromColnamesAndTypes(queryData, geomColumn, geomFormat),
  };
  if (queryDataClone.label_map) {
    queryDataClone.label_map = stripGeomColumnFromLabelMap(
      queryData.label_map,
      geomColumn,
      geomFormat,
    );
  }
  return queryDataClone;
};

// copy of
// superset-frontend/plugins/plugin-chart-echarts/src/utils/series.ts
export const formatSeriesName = (
  name: DataRecordValue | undefined,
  {
    numberFormatter,
    timeFormatter,
    coltype,
  }: {
    numberFormatter?: ValueFormatter;
    timeFormatter?: TimeFormatter;
    coltype?: GenericDataType;
  } = {},
) => {
  if (name === undefined || name === null) {
    return NULL_STRING;
  }
  if (typeof name === 'boolean' || typeof name === 'bigint') {
    return name.toString();
  }
  if (name instanceof Date || coltype === GenericDataType.Temporal) {
    const normalizedName =
      typeof name === 'string' ? normalizeTimestamp(name) : name;
    const d =
      normalizedName instanceof Date
        ? normalizedName
        : new Date(normalizedName);

    return timeFormatter ? timeFormatter(d) : d.toISOString();
  }
  if (typeof name === 'number') {
    return numberFormatter ? numberFormatter(name) : name.toString();
  }
  return name;
};

// copy of
// superset-frontend/plugins/plugin-chart-echarts/src/utils/series.ts
export const extractGroupbyLabel = ({
  datum = {},
  groupby,
  numberFormatter,
  timeFormatter,
  coltypeMapping = {},
}: {
  datum?: DataRecord;
  groupby?: string[] | null;
  numberFormatter?: NumberFormatter;
  timeFormatter?: TimeFormatter;
  coltypeMapping?: Record<string, GenericDataType>;
}) =>
  ensureIsArray(groupby)
    .map(val =>
      formatSeriesName(datum[val], {
        numberFormatter,
        timeFormatter,
        ...(coltypeMapping[val] && { coltype: coltypeMapping[val] }),
      }),
    )
    .join(', ');

// copy of
// superset-frontend/plugins/plugin-chart-echarts/src/utils/series.ts
export const getColtypesMapping = ({
  coltypes = [],
  colnames = [],
}: Pick<ChartDataResponseResult, 'coltypes' | 'colnames'>): Record<
  string,
  GenericDataType
> =>
  colnames.reduce(
    (accumulator, item, index) => ({ ...accumulator, [item]: coltypes[index] }),
    {},
  );

/**
 * Reserve label colors for the chart.
 *
 * We call the CategoricalColorNamespace singleton to reserve
 * label colors for the chart. This is necessary to ensure that
 * we do not run into color collisions when rendering multiple
 * charts in the same cartodiagram.
 *
 * TODO This only works in the context of a dashboard,
 *      since only there, the CategoricalColorNamespace singleton is being used.
 *      In the explore view, label colors cannot be reserved without changing
 *      the overall color handling in superset.
 *
 * @param formData The formdata of the underlying chart
 * @param dataByLocation The data grouped by location
 * @param strippedQueryData The query data without the geom column
 * @param sliceId The id of the chart slice
 */
export const reserveLabelColors = (
  formData: Record<string, any>,
  dataByLocation: LocationConfigMapping,
  strippedQueryData: any,
  sliceId: number,
) => {
  // Call color singleton to reserve label colors
  // get needed control values from underlying chart config
  const { colorScheme = '', groupby, dateFormat } = formData;
  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
  const groupbyLabels = groupby.map(getColumnLabel);
  Object.keys(dataByLocation).forEach(location => {
    const coltypeMapping = getColtypesMapping({
      ...strippedQueryData,
      data: dataByLocation[location],
    });
    dataByLocation[location].forEach(datum => {
      const name = extractGroupbyLabel({
        datum,
        groupby: groupbyLabels,
        coltypeMapping,
        timeFormatter: getTimeFormatter(dateFormat),
      });

      colorFn(name, sliceId);
    });
  });
};

/**
 * Create the chart configurations depending on the referenced Superset chart.
 *
 * @param selectedChart The configuration of the referenced Superset chart
 * @param geomColumn The name of the geometry column
 * @param geomFormat The format of the geometries
 * @param chartProps The properties provided within this OL plugin
 * @param chartTransformer The transformer function
 * @returns The chart configurations
 */
export const getChartConfigs = (
  selectedChart: SelectedChartConfig,
  geomColumn: string,
  geomFormat: GeometryFormat,
  chartProps: ChartProps,
  chartTransformer: any,
  sliceId: number,
) => {
  const chartFormDataSnake = selectedChart.params;
  const chartFormData = convertKeysToCamelCase(chartFormDataSnake);
  chartFormData.sliceId = sliceId;

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
      geomFormat,
      queryData,
    );
  } else {
    dataByLocation = groupByLocation(data, geomColumn);
  }
  const strippedQueryData = stripGeomColumnFromQueryData(
    queryData,
    geomColumn,
    geomFormat,
  );

  // We have to reserve the label colors before
  // transforming the chart props.
  reserveLabelColors(
    baseConfig.formData,
    dataByLocation,
    strippedQueryData,
    sliceId,
  );

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

    let geojsonFeature;

    if (geomFormat === GeometryFormat.GEOJSON) {
      geojsonFeature = {
        type: 'Feature',
        geometry: JSON.parse(location),
      };
    } else if (geomFormat === GeometryFormat.WKB) {
      geojsonFeature = wkbToGeoJSON(location);
    } else {
      geojsonFeature = wktToGeoJSON(location);
    }

    const feature: ChartConfigFeature = {
      type: 'Feature',
      geometry: geojsonFeature.geometry,
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
