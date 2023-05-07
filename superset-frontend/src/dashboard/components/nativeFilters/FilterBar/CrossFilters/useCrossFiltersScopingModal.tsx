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
import React, { ReactNode, useCallback, useMemo, useState } from 'react';
import { isDefined, NativeFilterScope, t } from '@superset-ui/core';
import { useSelector, useDispatch } from 'react-redux';
import Modal from 'src/components/Modal';
import { noOp } from 'src/utils/common';
import {
  ChartConfiguration,
  Layout,
  RootState,
  isCrossFilterScopeGlobal,
  GlobalChartCrossFilterConfig,
} from 'src/dashboard/types';
import { getChartIdsInFilterScope } from 'src/dashboard/util/getChartIdsInFilterScope';
import { useChartIds } from 'src/dashboard/util/charts/useChartIds';
import { setChartConfiguration } from 'src/dashboard/actions/dashboardInfo';
import { DEFAULT_CROSS_FILTER_SCOPING } from 'src/dashboard/constants';
import ScopingTree from '../../FiltersConfigModal/FiltersConfigForm/FilterScope/ScopingTree';

export const useCrossFiltersScopingModal = (
  chartId?: number,
): [() => void, ReactNode] => {
  const dispatch = useDispatch();
  const layout = useSelector<RootState, Layout>(
    state => state.dashboardLayout.present,
  );
  const chartIds = useChartIds();
  const [isVisible, setIsVisible] = useState(false);
  const openModal = useCallback(() => setIsVisible(true), []);
  const closeModal = useCallback(() => setIsVisible(false), []);
  const initialChartConfig = useSelector<RootState, ChartConfiguration>(
    state => state.dashboardInfo.metadata?.chart_configuration || {},
  );
  const defaultGlobalChartConfig = useMemo<GlobalChartCrossFilterConfig>(
    () => ({
      scope: DEFAULT_CROSS_FILTER_SCOPING,
      chartsInScope: chartIds,
    }),
    [chartIds],
  );

  const initialGlobalChartConfig = useSelector<
    RootState,
    GlobalChartCrossFilterConfig
  >(
    state =>
      state.dashboardInfo.metadata?.global_chart_configuration ||
      defaultGlobalChartConfig,
  );
  const [chartConfig, setChartConfig] = useState(initialChartConfig);
  const [globalChartConfig, setGlobalChartConfig] = useState(
    initialGlobalChartConfig,
  );
  const saveScoping = useCallback(() => {
    dispatch(
      setChartConfiguration({
        chartConfiguration: chartConfig,
        globalChartConfiguration: globalChartConfig,
      }),
    );
    closeModal();
  }, [chartConfig, closeModal, dispatch, globalChartConfig]);

  const handleScopeUpdate = useCallback(
    ({ scope }: { scope: NativeFilterScope }) => {
      if (isDefined(chartId)) {
        setChartConfig(prevConfig => ({
          ...prevConfig,
          [chartId]: {
            id: chartId,
            crossFilters: {
              scope,
              chartsInScope: getChartIdsInFilterScope(scope, chartIds, layout),
            },
          },
        }));
      } else {
        const globalChartsInScope = getChartIdsInFilterScope(
          scope,
          chartIds,
          layout,
        );
        setGlobalChartConfig({
          scope,
          chartsInScope: globalChartsInScope,
        });
        setChartConfig(prevConfig =>
          Object.entries(prevConfig).reduce((acc, [id, config]) => {
            if (config.crossFilters.scope === 'global') {
              acc[id] = {
                id,
                crossFilters: {
                  scope: 'global' as const,
                  chartsInScope: globalChartsInScope.filter(
                    chartId => chartId !== Number(config.id),
                  ),
                },
              };
            } else {
              acc[id] = config;
            }
            return acc;
          }, {}),
        );
      }
    },
    [chartId, chartIds, layout],
  );

  const scope = useMemo(() => {
    const globalScope = globalChartConfig.scope;
    if (!isDefined(chartId)) {
      return globalScope;
    }
    if (isCrossFilterScopeGlobal(chartConfig[chartId]?.crossFilters?.scope)) {
      return {
        rootPath: globalScope.rootPath,
        excluded: globalScope.excluded.filter(id => id !== chartId),
      };
    }
    return chartConfig[chartId]?.crossFilters?.scope as NativeFilterScope;
  }, [chartConfig, chartId, globalChartConfig.scope]);

  return [
    openModal,
    isVisible ? (
      <Modal
        onHide={closeModal}
        show={isVisible}
        title={t('Cross-filtering scoping')}
        destroyOnClose
        onHandledPrimaryAction={saveScoping}
      >
        <ScopingTree
          updateFormValues={handleScopeUpdate}
          initialScope={scope}
          forceUpdate={noOp}
          chartId={chartId}
        />
      </Modal>
    ) : null,
  ];
};
