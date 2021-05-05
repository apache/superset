import {
  ChartProps,
  DataRecord,
  getNumberFormatter,
} from '@superset-ui/core';
import sandboxedEval from '@superset-ui/legacy-preset-chart-deckgl/lib/utils/sandbox';


function insertMetricsIntoMarkdown(
  markdownTemplate: string,
  dataRecord: DataRecord,
  numberFormat: string,
  ignore: string[] = [],
) {
  const numberFormatter = getNumberFormatter(numberFormat);
  let markdown = markdownTemplate.slice(0);
  const regexp = /({{(.*?)}})/g;
  const matches = markdown.matchAll(regexp);

  for (const match of matches) {
    const metricLabel = match[2];
    let metric = dataRecord[metricLabel];
    if (metric) {
      if (typeof metric === 'number' && !ignore.includes(metricLabel)) {
        metric = numberFormatter(metric);
      }
      markdown = markdown.replace(match[1], String(metric));
    }
  }
  return markdown;
}

function getBackgroundColor(dataColorMapper: string, dataRecord: DataRecord) {
  let backgroundColor;
  if (dataColorMapper) {
    console.log('Setting background color with the passed function.');
    const jsFnMutator = sandboxedEval(dataColorMapper);
    backgroundColor = jsFnMutator(dataRecord);
  } else {
    console.log(
      'Setting default background color as no setter function was passed.',
    );
    backgroundColor = 'white';
  }
  return backgroundColor;
}

export default function transformProps(chartProps: ChartProps) {
  const { width, height, formData, queriesData } = chartProps;
  const {
    groupby,
    dataColorMapper,
    textColor,
    markdown,
    orientation,
    numberFormat,
    roundedCorners,
  } = formData;
  const data = (queriesData[0]?.data || []) as DataRecord[];
  const backgroundColors = data.map(dataRecord =>
    getBackgroundColor(dataColorMapper, dataRecord),
  );
  const markdowns = data.map(dataRecord =>
    insertMetricsIntoMarkdown(markdown, dataRecord, numberFormat, groupby),
  );

  const transformedProps = {
    markdowns,
    backgroundColors,
    textColor,
    orientation,
    roundedCorners,
  };

  console.log(4, formData);
  console.log(5, queriesData);
  console.log(6, transformedProps);

  return {
    width,
    height,
    ...transformedProps,
  };
}
