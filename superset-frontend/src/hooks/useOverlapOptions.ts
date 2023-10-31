import { useEffect, useState } from 'react';

const MANAGED_CONTROLS = { DIMENSIONS: 'groupby', FILTERS: 'adhoc_filters' };

const fetchOverlapOptions = async (metrics: string[]) => {
  const mutation = `
  mutation compute_dimensions_filters ($input: ComputeDimensionsFiltersInput!) {
    computeDimensionsFilters(input: $input) {
      computeResult {
        dimensions
        filters
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

interface IGetSetOverlappingOptions {
  metrics: any;
  columns: any[];
  options: any[];
  setOverlapProps: React.Dispatch<
    React.SetStateAction<{
      options?: any[];
      columns?: any[];
    }>
  >;
  name: string;
}

const getSetOverlappingOptionsColumns = async ({
  metrics,
  columns,
  options,
  setOverlapProps,
  name,
}: IGetSetOverlappingOptions): Promise<void> => {
  // ... await ...
  const respJSON = await fetchOverlapOptions(metrics);
  switch (name) {
    case MANAGED_CONTROLS.DIMENSIONS:
      if (
        !options ||
        !respJSON.data.computeDimensionsFilters.computeResult.dimensions
      ) {
        return;
      }

      setOverlapProps({
        options: filterArrByOverlap(
          options,
          respJSON.data.computeDimensionsFilters.computeResult.dimensions,
        ),
      });
      break;
    case MANAGED_CONTROLS.FILTERS:
      if (
        !columns ||
        !respJSON.data.computeDimensionsFilters.computeResult.filters
      ) {
        return;
      }
      setOverlapProps({
        columns: filterArrByOverlap(
          columns,
          respJSON.data.computeDimensionsFilters.computeResult.filters,
        ),
      });

      break;
    default:
  }
};

export const useOverlapOptions = (name: string, props: any, form_data: any) => {
  const [overlapProps, setOverlapProps] = useState({});

  useEffect(() => {
    if (
      props.savedMetrics &&
      Object.values(MANAGED_CONTROLS).includes(name) &&
      form_data?.metrics?.length
    ) {
      getSetOverlappingOptionsColumns({
        metrics: form_data?.metrics,
        columns: props.columns ?? [],
        options: props.options ?? [],
        setOverlapProps,
        name,
      });
    } else {
      setOverlapProps({});
    }
  }, [form_data?.metrics]);

  return { overlapProps };
};
