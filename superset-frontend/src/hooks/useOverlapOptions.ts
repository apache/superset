/* eslint-disable no-case-declarations */
import { useEffect, useState } from 'react';
import { QueryFormData } from '@superset-ui/core';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';

const MANAGED_CONTROLS = { DIMENSIONS: 'groupby', FILTERS: 'adhoc_filters' };

const fetchOverlapOptions = async (metrics: string[]) => {
  const mutation = `
  mutation compute_dimensions_filters ($input: ComputeDimensionsFiltersInput!) {
    computeDimensionsFilters(input: $input) {
      computeResult {
        dimensions
        filters
        defaultDimensions
        defaultFilters
    }
      errors {
        message
    }
    }
  }
`;

  const variables = {
    input: {
      metricNames: metrics ?? [],
    },
  };

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `APIKEY df35d168def6c26f2f88a79de95a5da04301d947      `,
    },
    body: JSON.stringify({ query: mutation, variables }),
  };

  const resp = await fetch(
    'https://mgmt.api.brightwrite-staging.com/graphql/',
    { ...options },
  );

  return resp.json();
};

const filterArrByOverlap = (
  defaultOptions: any[],
  overlapOptions: any[],
): any[] =>
  defaultOptions.filter(opt => overlapOptions.includes(opt.column_name)) ?? [];

const createDefaultFilter = (filterVal: string) => {
  const ahFilter = new AdhocFilter({
    sqlExpression: filterVal,
    expressionType: 'SQL',
  });

  ahFilter.subject = 'metricDefaultFilter';

  return ahFilter;
};

interface IGetSetOverlappingOptions {
  name: string;
  metrics: any;
  form_data: QueryFormData;
  columns: any[];
  options: any[];
  setOverlapProps: React.Dispatch<
    React.SetStateAction<{
      options?: any[];
      columns?: any[];
    }>
  >;
  setControlValue: TSetControlValue;
}

const getSetOverlappingOptionsColumns = async ({
  name,
  metrics,
  form_data,
  columns,
  options,
  setOverlapProps,
  setControlValue,
}: IGetSetOverlappingOptions): Promise<void> => {
  const respJSON = await fetchOverlapOptions(metrics);
  const respResult = respJSON.data.computeDimensionsFilters.computeResult;
  switch (name) {
    case MANAGED_CONTROLS.DIMENSIONS:
      if (!options || !respResult.dimensions) {
        return;
      }

      const overlapOptions = filterArrByOverlap(options, respResult.dimensions);
      const overlapOptionsColNames = overlapOptions.map(opt => opt.column_name);

      setOverlapProps({
        options: overlapOptions,
      });

      let validSelectedDimensions: string[] = form_data[name];

      if (form_data[name].length) {
        const newSelectedDimensions = form_data[name].filter((setVal: string) =>
          overlapOptionsColNames.includes(setVal),
        );

        if (form_data[name].length !== newSelectedDimensions.length) {
          validSelectedDimensions = newSelectedDimensions;
        }
      }

      const validDefaultDimensions = filterArrByOverlap(
        overlapOptions,
        respResult.defaultDimensions,
      );

      if (validDefaultDimensions) {
        validSelectedDimensions = Array.from(
          new Set([...validDefaultDimensions, ...validSelectedDimensions]),
        );
      }

      setControlValue(name, validSelectedDimensions);

      break;
    case MANAGED_CONTROLS.FILTERS:
      if (!columns || !respResult.filters) {
        return;
      }

      let validSelectedFilters: string[] = form_data[name];

      const overlapOptionsFilters = filterArrByOverlap(
        columns,
        respResult.filters,
      );
      const overlapOptionsFiltersColNames = overlapOptionsFilters.map(
        opt => opt.column_name,
      );

      setOverlapProps({
        columns: overlapOptionsFilters,
      });

      if (form_data[name].length) {
        validSelectedFilters = form_data[name].filter(
          (setVal: any) =>
            overlapOptionsFiltersColNames.includes(setVal.subject) ||
            (setVal.expressionType === 'SQL' && !setVal.subject), // keep only custom SQL filters created by user, remove default filters
        );
      }

      if (respResult.defaultFilters.length) {
        const newDefaultFilters = respResult.defaultFilters.map(
          (sqlName: string) => createDefaultFilter(sqlName),
        );

        validSelectedFilters = [...validSelectedFilters, ...newDefaultFilters];
      }

      setControlValue(name, validSelectedFilters);

      break;
    default:
  }
};

type TSetControlValue = (
  controlName: string,
  value: any,
  validationErrors?: any[] | undefined,
) => {
  type: string;
  controlName: string;
  value: any;
  validationErrors: any[] | undefined;
};

interface ISetControlValue {
  name: string;
  props: any;
  form_data?: QueryFormData;
  setControlValue: TSetControlValue;
}

export const useOverlapOptions = (propsB: ISetControlValue) => {
  const { name, props, form_data, setControlValue } = propsB;
  const [overlapProps, setOverlapProps] = useState({});

  useEffect(() => {
    if (
      props.savedMetrics &&
      Object.values(MANAGED_CONTROLS).includes(name) &&
      form_data?.metrics?.length
    ) {
      getSetOverlappingOptionsColumns({
        name,
        metrics: form_data?.metrics,
        form_data,
        columns: props.columns ?? [],
        options: props.options ?? [],
        setOverlapProps,
        setControlValue,
      });
    } else {
      setOverlapProps({});
    }
  }, [form_data?.metrics]);

  return { overlapProps };
};
