/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  dvtSidebarAlertsSetProperty,
  dvtSidebarChartAddSetProperty,
  dvtSidebarConnectionSetProperty,
  dvtSidebarDatasetsSetProperty,
  dvtSidebarReportsSetProperty,
  dvtSidebarDashboardSetProperty,
  dvtSidebarSetDataProperty,
} from 'src/dvt-redux/dvt-sidebarReducer';
import { useAppSelector } from 'src/hooks/useAppSelector';
import { nativeFilterGate } from 'src/dashboard/components/nativeFilters/utils';
import { ChartMetadata, t } from '@superset-ui/core';
import useFetch from 'src/hooks/useFetch';
import DvtLogo from '../DvtLogo';
import DvtDarkMode from '../DvtDarkMode';
import DvtTitlePlus from '../DvtTitlePlus';
import DvtNavigation from '../DvtNavigation';
import DvtFolderNavigation from '../DvtFolderNavigation';
import DvtSelect from '../DvtSelect';
import DvtNavigationBar from '../DvtNavigationBar';
import { DvtSidebarData, DefaultOrder } from './dvtSidebarData';
import {
  StyledDvtSidebar,
  StyledDvtSidebarHeader,
  StyledDvtSidebarBody,
  StyledDvtSidebarBodyItem,
  StyledDvtSidebarBodySelect,
  StyledDvtSidebarFooter,
  StyledDvtSidebarNavbarLogout,
} from './dvt-sidebar.module';
import DvtList from '../DvtList';
import DvtDatePicker from '../DvtDatepicker';
import { usePluginContext } from '../DynamicPlugins';

interface DvtSidebarProps {
  pathName: string;
}

type VizEntry = {
  key: string;
  value: ChartMetadata;
};

const DvtSidebar: React.FC<DvtSidebarProps> = ({ pathName }) => {
  const dispatch = useDispatch();
  const reportsSelector = useAppSelector(state => state.dvtSidebar.reports);
  const alertsSelector = useAppSelector(state => state.dvtSidebar.alerts);
  const sqlSelector = useAppSelector(state => state.dvtNavbar.sql);
  const datasetsSelector = useAppSelector(state => state.dvtSidebar.datasets);
  const connectionSelector = useAppSelector(
    state => state.dvtSidebar.connection,
  );
  const chartAddSelector = useAppSelector(state => state.dvtSidebar.chartAdd);
  const dashboardSelector = useAppSelector(state => state.dvtSidebar.dashboard);
  const dataSelector = useAppSelector(state => state.dvtSidebar.data);
  const fetchedSelector = useAppSelector(
    state => state.dvtSidebar.data.fetched,
  );
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [active, setActive] = useState<string>('test');

  const pathTitles = (pathname: string) => {
    switch (pathname) {
      case '/superset/welcome/':
        return 'Welcome Page';
      case '/dashboard/list/':
        return 'Dashboards';
      case '/alert/list/':
        return 'Alerts';
      case '/report/list/':
        return 'Reports';
      case '/databaseview/list/':
        return 'Connection';
      case '/superset/sqllab/':
        return 'SQL Lab';
      case '/tablemodelview/list/':
        return 'Datasets';
      case '/superset/sqllab/history/':
        return 'SQL History';
      case '/superset/profile/admin/':
        return 'Profile';
      case '/chart/add':
        return 'Chart Add';
      case '/dataset/add/':
        return 'New Dataset';
      default:
        return '';
    }
  };

  const sidebarDataFindPathname = DvtSidebarData.find(
    (item: { pathname: string }) => {
      if (pathName === '/superset/sqllab/history/') {
        return sqlSelector.tabs === 'Query History'
          ? item.pathname === pathName
          : item.pathname === '/superset/sqllab/saved_queries/';
      }
      return item.pathname === pathName;
    },
  );

  const updateReportsProperty = (value: string, propertyName: string) => {
    dispatch(
      dvtSidebarReportsSetProperty({
        reports: {
          ...reportsSelector,
          [propertyName]: value,
        },
      }),
    );
  };

  const updateAlertsProperty = (value: string, propertyName: string) => {
    dispatch(
      dvtSidebarAlertsSetProperty({
        alerts: {
          ...alertsSelector,
          [propertyName]: value,
        },
      }),
    );
  };

  const updateConnectionProperty = (value: string, propertyName: string) => {
    dispatch(
      dvtSidebarConnectionSetProperty({
        connection: {
          ...connectionSelector,
          [propertyName]: value,
        },
      }),
    );
  };

  const updateDatasetsProperty = (value: string, propertyName: string) => {
    dispatch(
      dvtSidebarDatasetsSetProperty({
        datasets: {
          ...datasetsSelector,
          [propertyName]: value,
        },
      }),
    );
  };

  const updateDashboardProperty = (value: string, propertyName: string) => {
    dispatch(
      dvtSidebarDashboardSetProperty({
        key: propertyName,
        value,
      }),
    );
  };

  const updateChartAddProperty = (value: string, propertyName: string) => {
    const changesOneItem = ['recommended_tags', 'category', 'tags'];
    if (chartAddSelector[propertyName] !== value) {
      if (changesOneItem.includes(propertyName)) {
        const oneSelectedItem = changesOneItem.reduce((acc, item) => {
          acc[item] = propertyName === item ? value : '';
          return acc;
        }, {});
        dispatch(
          dvtSidebarChartAddSetProperty({
            chartAdd: {
              ...chartAddSelector,
              ...oneSelectedItem,
            },
          }),
        );
      } else {
        dispatch(
          dvtSidebarChartAddSetProperty({
            chartAdd: {
              ...chartAddSelector,
              [propertyName]: value,
            },
          }),
        );
      }
    }
  };

  const [getDataApiUrl, setGetDataApiUrl] = useState<{
    name: string;
    url: string | null;
  }>({ name: '', url: null });

  const getApiData = useFetch({ url: getDataApiUrl.url });

  useEffect(() => {
    const apiV1 = '/api/v1/';
    if (pathTitles(pathName) === 'Dashboards') {
      if (!fetchedSelector.dashboard.owner) {
        setGetDataApiUrl({
          name: 'dashboard-owner',
          url: `${apiV1}dashboard/related/owners`,
        });
      } else if (!fetchedSelector.dashboard.createdBy) {
        setGetDataApiUrl({
          name: 'dashboard-createdBy',
          url: `${apiV1}dashboard/related/created_by`,
        });
      }
    } else if (pathTitles(pathName) === 'Chart Add') {
      if (!fetchedSelector.chartAdd.dataset) {
        setGetDataApiUrl({
          name: 'chartAdd-dataset',
          url: `${apiV1}dataset/`,
        });
      }
    }
  }, [fetchedSelector.dashboard, fetchedSelector.chartAdd]);

  useEffect(() => {
    if (getApiData) {
      const data = getApiData?.result;
      if (getDataApiUrl.name === 'dashboard-owner') {
        const editedData = data.map((item: any) => ({
          value: item.value,
          label: item.text,
        }));
        dispatch(
          dvtSidebarSetDataProperty({
            pageKey: 'dashboard',
            key: 'owner',
            value: editedData,
          }),
        );
      }
      if (getDataApiUrl.name === 'dashboard-createdBy') {
        const editedData = data.map((item: any) => ({
          value: item.value,
          label: item.text,
        }));
        dispatch(
          dvtSidebarSetDataProperty({
            pageKey: 'dashboard',
            key: 'createdBy',
            value: editedData,
          }),
        );
      }
      if (getDataApiUrl.name === 'chartAdd-dataset') {
        const editedData = data.map((item: any) => ({
          value: item.table_name,
          label: item.table_name,
        }));
        dispatch(
          dvtSidebarSetDataProperty({
            pageKey: 'chartAdd',
            key: 'dataset',
            value: editedData,
          }),
        );
      }
    }
  }, [getApiData]);

  const { mountedPluginMetadata } = usePluginContext();
  const typesWithDefaultOrder = new Set(DefaultOrder);
  const RECOMMENDED_TAGS = [
    t('Popular'),
    t('ECharts'),
    t('Advanced-Analytics'),
  ];
  const OTHER_CATEGORY = t('Other');

  function vizSortFactor(entry: VizEntry) {
    if (typesWithDefaultOrder.has(entry.key)) {
      return DefaultOrder.indexOf(entry.key);
    }
    return DefaultOrder.length;
  }
  const chartMetadata: VizEntry[] = useMemo(() => {
    const result = Object.entries(mountedPluginMetadata)
      .map(([key, value]) => ({ key, value }))
      .filter(
        ({ value }) =>
          nativeFilterGate(value.behaviors || []) && !value.deprecated,
      );
    result.sort((a, b) => vizSortFactor(a) - vizSortFactor(b));
    return result;
  }, [mountedPluginMetadata]);

  const chartsByTags = useMemo(() => {
    const result: Record<string, VizEntry[]> = {};

    chartMetadata.forEach(entry => {
      const tags = entry.value.tags || [];
      tags.forEach(tag => {
        if (!result[tag]) {
          result[tag] = [];
        }
        result[tag].push(entry);
      });
    });

    return result;
  }, [chartMetadata]);

  const tags = useMemo(
    () =>
      Object.keys(chartsByTags)
        .sort((a, b) => a.localeCompare(b))
        .filter(tag => RECOMMENDED_TAGS.indexOf(tag) === -1),
    [chartsByTags],
  );

  const chartsByCategory = useMemo(() => {
    const result: Record<string, VizEntry[]> = {};
    chartMetadata.forEach(entry => {
      const category = entry.value.category || OTHER_CATEGORY;
      if (!result[category]) {
        result[category] = [];
      }
      result[category].push(entry);
    });
    return result;
  }, [chartMetadata]);

  const categories = useMemo(
    () =>
      Object.keys(chartsByCategory).sort((a, b) => {
        // make sure Other goes at the end
        if (a === OTHER_CATEGORY) return 1;
        if (b === OTHER_CATEGORY) return -1;
        // sort alphabetically
        return a.localeCompare(b);
      }),
    [chartsByCategory],
  );

  const tag: { value: string; label: string }[] = tags.map(tag => ({
    value: tag,
    label: tag,
  }));

  const category: { value: string; label: string }[] = categories.map(
    categories => ({ value: categories, label: categories }),
  );

  const selectsData = (sData: any) => {
    let dValue = [];

    if (pathTitles(pathName) === 'Chart Add' && sData.name === 'dataset') {
      dValue = dataSelector.chartAdd.dataset;
    } else if (pathTitles(pathName) === 'Chart Add' && sData.name === 'tags') {
      dValue = tag;
    } else if (
      pathTitles(pathName) === 'Chart Add' &&
      sData.name === 'category'
    ) {
      dValue = category;
    } else if (
      pathTitles(pathName) === 'Dashboards' &&
      sData.name === 'owner'
    ) {
      dValue = dataSelector.dashboard.owner;
    } else if (
      pathTitles(pathName) === 'Dashboards' &&
      sData.name === 'createdBy'
    ) {
      dValue = dataSelector.dashboard.createdBy;
    } else {
      dValue = sData.values;
    }

    return dValue;
  };

  return (
    <StyledDvtSidebar pathName={pathName}>
      <StyledDvtSidebarHeader>
        <DvtLogo title="AppName" />
      </StyledDvtSidebarHeader>
      {pathTitles(pathName) === 'Welcome Page' && (
        <StyledDvtSidebarBody pathName={pathName}>
          {sidebarDataFindPathname?.data.map((data: any, index: number) => (
            <StyledDvtSidebarBodyItem key={index}>
              {data.titleMenu === 'folder navigation' && (
                <>
                  <DvtTitlePlus title={data.title} />
                  <DvtNavigation data={data.data} />
                </>
              )}
              {data.titleMenu === 'folder' && (
                <>
                  <DvtTitlePlus title={data.title} onClick={() => {}} />
                  <DvtFolderNavigation data={data.data} />
                </>
              )}
              {data.titleMenu === 'shared folder' && (
                <DvtTitlePlus title={data.title} onClick={() => {}} />
              )}
            </StyledDvtSidebarBodyItem>
          ))}
        </StyledDvtSidebarBody>
      )}

      {(pathTitles(pathName) === 'Datasets' ||
        pathTitles(pathName) === 'New Dataset' ||
        pathTitles(pathName) === 'Dashboards' ||
        pathTitles(pathName) === 'Alerts' ||
        pathTitles(pathName) === 'Reports' ||
        pathTitles(pathName) === 'Connection' ||
        pathTitles(pathName) === 'SQL Lab' ||
        pathTitles(pathName) === 'Chart Add' ||
        pathTitles(pathName) === 'SQL History') && (
        <StyledDvtSidebarBody pathName={pathName}>
          {sidebarDataFindPathname?.data.map(
            (
              data: {
                label: string;
                values: { label: string; value: string }[];
                placeholder: string;
                valuesList?: { id: number; title: string; subtitle: string }[];
                title: string;
                datePicker?: boolean;
                name: string;
              },
              index: number,
            ) => (
              <StyledDvtSidebarBodySelect key={index}>
                {!data.datePicker && !data.valuesList && (
                  <DvtSelect
                    data={selectsData(data)}
                    label={data.label}
                    placeholder={data.placeholder}
                    selectedValue={
                      pathTitles(pathName) === 'Reports'
                        ? reportsSelector[data.name]
                        : pathTitles(pathName) === 'Alerts'
                        ? alertsSelector[data.name]
                        : pathTitles(pathName) === 'Connection'
                        ? connectionSelector[data.name]
                        : pathTitles(pathName) === 'Datasets'
                        ? datasetsSelector[data.name]
                        : pathTitles(pathName) === 'Chart Add'
                        ? chartAddSelector[data.name]
                        : pathTitles(pathName) === 'Dashboards'
                        ? dashboardSelector[data.name]
                        : undefined
                    }
                    setSelectedValue={value => {
                      if (pathTitles(pathName) === 'Reports') {
                        updateReportsProperty(value, data.name);
                      } else if (pathTitles(pathName) === 'Alerts') {
                        updateAlertsProperty(value, data.name);
                      } else if (pathTitles(pathName) === 'Connection') {
                        updateConnectionProperty(value, data.name);
                      } else if (pathTitles(pathName) === 'Datasets') {
                        updateDatasetsProperty(value, data.name);
                      } else if (pathTitles(pathName) === 'Chart Add') {
                        updateChartAddProperty(value, data.name);
                      } else if (pathTitles(pathName) === 'Dashboards') {
                        updateDashboardProperty(value, data.name);
                      }
                    }}
                    maxWidth
                  />
                )}
                {data.valuesList && (
                  <>
                    <DvtSelect
                      data={data.values}
                      label={data.label}
                      placeholder={data.placeholder}
                      selectedValue=""
                      setSelectedValue={() => {}}
                      maxWidth
                    />
                    <DvtList data={data.valuesList} title={data.title} />
                  </>
                )}
                {data.datePicker && (
                  <DvtDatePicker
                    isOpen
                    label={data.label}
                    placeholder={data.placeholder}
                    selectedDate={null}
                    setIsOpen={() => {}}
                    setSelectedDate={() => {}}
                    maxWidth
                  />
                )}
              </StyledDvtSidebarBodySelect>
            ),
          )}
        </StyledDvtSidebarBody>
      )}

      {pathTitles(pathName) === 'Profile' && (
        <StyledDvtSidebarBody pathName={pathName}>
          {sidebarDataFindPathname?.data.map((data: any, index: number) => (
            <StyledDvtSidebarBodyItem key={index}>
              <DvtNavigationBar
                active={active}
                data={data.items}
                setActive={setActive}
              />
              <StyledDvtSidebarNavbarLogout>
                <DvtNavigationBar data={data.itemsLogout} />
              </StyledDvtSidebarNavbarLogout>
            </StyledDvtSidebarBodyItem>
          ))}
        </StyledDvtSidebarBody>
      )}
      {pathTitles(pathName) === 'Welcome Page' && (
        <StyledDvtSidebarFooter>
          <DvtDarkMode darkMode={darkMode} setDarkMode={setDarkMode} />
        </StyledDvtSidebarFooter>
      )}
    </StyledDvtSidebar>
  );
};

export default DvtSidebar;
