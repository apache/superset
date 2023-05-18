import React, { useState, useCallback, useEffect } from 'react';
import SelectControl from 'src/explore/components/controls/SelectControl';
import { bootstrapData } from 'src/preamble';
import Button from 'src/components/Button';
import {
  t,
  SupersetClient,
  validateNonEmpty,
  withTheme,
  SupersetTheme,
} from '@superset-ui/core';

interface Props {
  dashboardID: number;
  filters: any[];
  advancedDataType: string;
  error: string;
  visiblePopoverIndex: number;
  close: () => void;
  addDrillActionConfig: (drillactionConfig: any) => boolean;
  removeDrillActionConfig: () => boolean;
}
const useDashboardState = () => {
  const [dashboardList, setDashboardList] = useState([]);

  const [filterList, setFilterList] = useState([]);

  const fetchDashboardList = useCallback(() => {
    const endpoint = `/api/v1/dashboard`;
    SupersetClient.get({ endpoint })
      .then(({ json }) => {
        const dashboards = json.result
          .filter(
            (e: any) =>
              JSON.parse(e.json_metadata)?.native_filter_configuration,
          )
          .map((e: any) => ({ value: e.id, label: e.dashboard_title }));
        setDashboardList(dashboards);
      })
      .catch(error => {});
  }, []);

  const fetchFilterList = useCallback((dashboardId: number) => {
    const endpoint = `/api/v1/dashboard/${dashboardId}`;
    if (dashboardId < 0) return;
    SupersetClient.get({ endpoint })
      .then(({ json }) => {
        const metadata = JSON.parse(json.result.json_metadata);

        setFilterList(
          metadata?.native_filter_configuration.map((e: any) => ({
            value: e.id,
            label: e.name,
            column: e?.targets[0].column?.name || '',
          })),
        );
      })
      .catch(error => {});
  }, []);

  return {
    dashboardList,
    filterList,
    fetchDashboardList,
    fetchFilterList,
  };
};

const DrillActionConfig: React.FC<Props> = (props: Props) => {
  const { dashboardID, filters, advancedDataType, visiblePopoverIndex } = props;

  const { dashboardList, filterList, fetchDashboardList, fetchFilterList } =
    useDashboardState();

  const [selectedDashboardID, setSelectedDashboardID] =
    useState<number>(dashboardID);

  const [selectedFilters, setSelectedFilters] = useState(
    filters?.map((filter: any) => filter.value) || [],
  );

  const [advancedDataTypeName, setAdvancedDataTypeName] =
    useState<string>(advancedDataType);

  const [state, setState] = useState({
    isNew: !props.dashboardID,
  });

  useEffect(() => {
    setSelectedFilters(filters?.map((filter: any) => filter.value) || []);
    setSelectedDashboardID(dashboardID);
    setAdvancedDataTypeName(advancedDataType);
  }, [dashboardID, filters, advancedDataType, visiblePopoverIndex]);
  useEffect(() => {
    fetchDashboardList();
  }, [fetchDashboardList]);

  useEffect(() => {
    fetchFilterList(selectedDashboardID);
  }, [fetchFilterList, selectedDashboardID]);

  const isValidForm = () => {
    const errors = [
      validateNonEmpty(selectedDashboardID),
      validateNonEmpty(selectedFilters),
      validateNonEmpty(advancedDataTypeName),
    ];
    return !errors.filter(x => x).length;
  };
  const applyDrillActionConfig = () => {
    if (isValidForm()) {
      const element: any = (dashboardList || []).find(
        (e: any) => e.value === selectedDashboardID,
      );
      const advancedDataTypeNameLabel =
        bootstrapData?.common?.advanced_data_types?.find(
          (e: { id: string }) => e.id === advancedDataTypeName,
        )?.verbose_name || advancedDataTypeName;
      const selectedFiltersWithColumn = filterList.filter((filter: any) =>
        selectedFilters.includes(filter.value),
      );
      const name = `${element?.label} | ${advancedDataTypeNameLabel}`;
      const newDrillActionConfig = {
        dashboardID: selectedDashboardID,
        filters: selectedFiltersWithColumn,
        dashBoardName: element?.label || '',
        advancedDataType: advancedDataTypeName,
        name,
      };
      props.addDrillActionConfig(newDrillActionConfig);
      setState({ ...state, isNew: false });
      props.close();
    }
  };

  const onDashboardChange = (v: any) => {
    setSelectedDashboardID(v);
    setSelectedFilters([]);
  };
  return (
    <div style={{ width: 400 }}>
      <div style={{ width: '9000', paddingBottom: 25 }}>
        <SelectControl
          css={(theme: SupersetTheme) => ({ marginBottom: theme.gridUnit * 4 })}
          ariaLabel={t('Annotation layer value')}
          name="annotation-layer-value"
          label={t('DashBoard')}
          showHeader
          hovered
          placeholder=""
          options={dashboardList}
          value={selectedDashboardID}
          onChange={onDashboardChange}
        />
        <SelectControl
          style={{ length: '100%' }}
          ariaLabel="Advanced Data Type"
          name="advanced-data-type-value"
          label="Advanced Data Type"
          showHeader
          hovered
          freeForm
          placeholder=""
          options={bootstrapData?.common?.advanced_data_types?.map(
            (v: { id: any; verbose_name: any }) => ({
              value: v.id,
              label: v.verbose_name,
            }),
          )}
          value={advancedDataTypeName}
          onChange={setAdvancedDataTypeName}
        />
        <SelectControl
          ariaLabel={t('Annotation layer value')}
          name="annotation-layer-value"
          label={t('Filters')}
          showHeader
          hovered
          multi
          placeholder=""
          options={filterList}
          value={selectedFilters}
          onChange={setSelectedFilters}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button buttonSize="small" onClick={() => props.close()}>
          {t('Cancel')}
        </Button>
        <div>
          <Button
            buttonSize="small"
            buttonStyle="primary"
            disabled={!isValidForm()}
            onClick={applyDrillActionConfig}
          >
            {t('OK')}
          </Button>
        </div>
      </div>
    </div>
  );
};
export default withTheme(DrillActionConfig);
