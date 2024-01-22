import React, { useState, useEffect } from 'react';
import rison from 'rison';
import querystring from 'query-string';
import { JsonResponse, SupersetClient, t } from '@superset-ui/core';
import { RouteComponentProps } from 'react-router-dom';
import withToasts from 'src/components/MessageToasts/withToasts';
import { findPermission } from 'src/utils/findPermission';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import {
  Dataset,
  DatasetSelectLabel,
} from 'src/features/datasets/DatasetSelectLabel';
import DvtVizTypeGallery from 'src/explore/components/controls/VizTypeControl/DvtVizTypeGallery';

interface ChartCreationProps extends RouteComponentProps {
  user: UserWithPermissionsAndRoles;
  addSuccessToast: (arg: string) => void;
}

interface ChartCreationState {
  datasource?: { label: string; value: string };
  datasetName?: string | string[] | null;
  vizType: string | null;
  canCreateDataset: boolean;
}

const denyList: string[] = ['filter_box'];

const DvtChartAdd: React.FC<ChartCreationProps> = ({
  user,
  addSuccessToast,
}) => {
  const [chart, setChart] = useState<ChartCreationState>({
    vizType: null,
    canCreateDataset: findPermission('can_write', 'Dataset', user.roles),
  });

  useEffect(() => {
    const params = querystring.parse(window.location.search)?.dataset as string;
    if (params) {
      loadDatasources(params, 0, 1).then(r => {
        const datasource = r.data[0];
        datasource.label = datasource.customLabel;
        setChart(prevState => ({ ...prevState, datasource }));
      });
      addSuccessToast(t('The dataset has been saved'));
    }
  }, []);

  const changeVizType = (vizType: string | null) => {
    setChart(prevState => ({ ...prevState, vizType }));
  };

  const loadDatasources = (search: string, page: number, pageSize: number) => {
    const query = rison.encode({
      columns: [
        'id',
        'table_name',
        'datasource_type',
        'database.database_name',
        'schema',
      ],
      filters: [{ col: 'table_name', opr: 'ct', value: search }],
      page,
      page_size: pageSize,
      order_column: 'table_name',
      order_direction: 'asc',
    });
    return SupersetClient.get({
      endpoint: `/api/v1/dataset/?q=${query}`,
    }).then((response: JsonResponse) => {
      const list: {
        customLabel: string;
        id: number;
        label: string;
        value: string;
      }[] = response.json.result.map((item: Dataset) => ({
        id: item.id,
        value: `${item.id}__${item.datasource_type}`,
        customLabel: DatasetSelectLabel(item),
        label: item.table_name,
      }));
      return {
        data: list,
        totalCount: response.json.count,
      };
    });
  };

  return (
    <DvtVizTypeGallery
      denyList={denyList}
      className="viz-gallery"
      onChange={changeVizType}
      onDoubleClick={() => {}}
      selectedViz={chart.vizType}
    />
  );
};

export default withToasts(DvtChartAdd);
