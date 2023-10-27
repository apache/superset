import { useEffect, useState } from 'react';

const MANAGED_CONTROLS = { DIMENSIONS: 'groupby', FILTERS: 'adhoc_filters' };

const fetchOverlapOptions = async (metrics: string[]) => {
  // const response = await
  // MOCK endpoint
  fetch('http://localhost:8000/getDimensions?metrics=' + metrics.join(','), {
    method: 'GET',
  });

  // return response;
  return ['1', '2'];
};

const filterArrByOverlap = (defaultOptions, overlapOptions) => {
  return [defaultOptions[0], defaultOptions[1]];
};

interface IGetSetOverlappingOptions {
  metrics: any;
  columns: any[];
  options: any[];
  setFilterProps: React.Dispatch<React.SetStateAction<never[]>>;
  name: string;
}

const getSetOverlappingOptionsColumns = async ({
  metrics,
  columns,
  options,
  setFilterProps,
  name,
}: IGetSetOverlappingOptions): void => {
  // ... await ...
  // const fetchDimensions = fetchOverlapOptions(metrics);
  switch (name) {
    case MANAGED_CONTROLS.DIMENSIONS:
      setFilterProps({ options: [options[0], options[2]] });
      // setFilterProps(filterArrByOverlap(options, fetchDimensions.options))
      break;
    case MANAGED_CONTROLS.FILTERS:
      setFilterProps({ columns: [columns[0], columns[2], columns[4]] });
      // setFilterProps(filterArrByOverlap(columns, fetchDimensions.columns))

      break;
    default:
  }
};

export function useOverlappingOptions({ name, props }) {
  const [filterProps, setFilterProps] = useState({});

  useEffect(() => {
    if (props.savedMetrics && Object.values(MANAGED_CONTROLS).includes(name)) {
      getSetOverlappingOptionsColumns({
        metrics: props.savedMetrics,
        columns: props.columns ?? [],
        options: props.options ?? [],
        setFilterProps,
        name,
      });
    }
  }, [props.savedMetrics]);

  return { filterProps };
}
