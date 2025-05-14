import { DataMaskWithId } from '@superset-ui/core';
import { keyBy } from 'lodash';
import { chart } from 'src/components/Chart/chartReducer';
import { getInitialDataMask } from 'src/dataMask/reducer';
import { applyDefaultFormData } from 'src/explore/store';

export const HYDRATE_EMBEDDED = 'HYDRATE_EMBEDDED';

// Define proper interfaces for our objects
interface ChartQueries {
  [key: number]: {
    id: number;
    form_data: any;
  };
}

interface Slices {
  [key: number]: {
    slice_id: number;
    slice_url: string;
    slice_name: string;
    form_data: any;
    viz_type: string;
    datasource: any;
    description: string;
    description_markeddown: string;
    owners: any[];
    modified: string;
    changed_on: number;
  };
}

interface DataMask {
  [key: number]: DataMaskWithId;
}

interface ExploreData {
  slice: {
    slice_id: number;
    slice_url: string;
    slice_name: string;
    form_data: {
      viz_type: string;
      datasource: any;
      [key: string]: any;
    };
    description: string;
    description_markeddown: string;
    owners: any[];
    modified: string;
    changed_on: string;
  };
  dataset: {
    uid: string;
    [key: string]: any;
  };
}

const hydrateEmbedded = (exploreData: ExploreData) => {
  const chartQueries: ChartQueries = {};
  const slices: Slices = {};
  const { slice } = exploreData;
  const key = slice.slice_id;
  const formData = {
    ...slice.form_data,
  };
  const cleanStateForDataMask: DataMask = {};

  cleanStateForDataMask[key] = {
    ...(getInitialDataMask(key) as DataMaskWithId),
  };

  chartQueries[key] = {
    ...chart,
    id: key,
    form_data: applyDefaultFormData(formData),
  };

  slices[key] = {
    slice_id: key,
    slice_url: slice.slice_url,
    slice_name: slice.slice_name,
    form_data: slice.form_data,
    viz_type: slice.form_data.viz_type,
    datasource: slice.form_data.datasource,
    description: slice.description,
    description_markeddown: slice.description_markeddown,
    owners: slice.owners,
    modified: slice.modified,
    changed_on: new Date(slice.changed_on).getTime(),
  };

  const datasourceObj = [exploreData.dataset];
  const modifiedDs = keyBy(datasourceObj, 'uid');

  return {
    type: HYDRATE_EMBEDDED,
    data: {
      charts: chartQueries,
      datasources: modifiedDs,
      sliceEntities: { slices },
      dataMask: cleanStateForDataMask,
    },
  };
};

export default hydrateEmbedded;
