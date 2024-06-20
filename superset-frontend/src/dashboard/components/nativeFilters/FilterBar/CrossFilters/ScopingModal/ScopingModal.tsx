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
import { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { isDefined, NativeFilterScope, t } from '@superset-ui/core';
import Modal from 'src/components/Modal';
import {
  ChartConfiguration,
  Layout,
  RootState,
  isCrossFilterScopeGlobal,
  GlobalChartCrossFilterConfig,
  GLOBAL_SCOPE_POINTER,
} from 'src/dashboard/types';
import { getChartIdsInFilterScope } from 'src/dashboard/util/getChartIdsInFilterScope';
import { useChartIds } from 'src/dashboard/util/charts/useChartIds';
import { saveChartConfiguration } from 'src/dashboard/actions/dashboardInfo';
import { DEFAULT_CROSS_FILTER_SCOPING } from 'src/dashboard/constants';
import { ScopingModalContent } from './ScopingModalContent';
import { NEW_CHART_SCOPING_ID } from './constants';

const getUpdatedGloballyScopedChartsInScope = (
  configs: ChartConfiguration,
  globalChartsInScope: number[],
) =>
  Object.entries(configs).reduce((acc, [id, config]) => {
    if (isCrossFilterScopeGlobal(config.crossFilters.scope)) {
      acc[id] = {
        id: Number(config.id),
        crossFilters: {
          scope: GLOBAL_SCOPE_POINTER,
          chartsInScope: globalChartsInScope.filter(
            chartId => chartId !== Number(config.id),
          ),
        },
      };
    } else {
      acc[id] = config;
    }
    return acc;
  }, {});

const getActualScopeFromGlobalScope = (
  chartId: number,
  globalScope: NativeFilterScope,
) => ({
  rootPath: globalScope.rootPath,
  excluded: globalScope.excluded.filter(id => id !== chartId),
});

export interface ScopingModalProps {
  initialChartId: number | undefined;
  isVisible: boolean;
  closeModal: () => void;
}

export const ScopingModal = ({
  initialChartId,
  isVisible,
  closeModal,
}: ScopingModalProps) => {
  const dispatch = useDispatch();
  const layout = useSelector<RootState, Layout>(
    state => state.dashboardLayout.present,
  );
  const chartIds = useChartIds();
  const [currentChartId, setCurrentChartId] = useState(initialChartId);
  const initialChartConfig = useSelector<RootState, ChartConfiguration>(
    state => state.dashboardInfo.metadata?.chart_configuration || {},
  );
  const defaultGlobalChartConfig = useMemo(
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

  const getInitialChartConfig = () => {
    if (
      isDefined(initialChartId) &&
      isCrossFilterScopeGlobal(
        initialChartConfig[initialChartId]?.crossFilters.scope,
      )
    ) {
      return {
        ...initialChartConfig,
        [initialChartId]: {
          id: initialChartId,
          crossFilters: {
            scope: getActualScopeFromGlobalScope(
              initialChartId,
              initialGlobalChartConfig.scope,
            ),
            chartsInScope:
              initialChartConfig[initialChartId]?.crossFilters.chartsInScope,
          },
        },
      };
    }
    return initialChartConfig;
  };

  const [chartConfigs, setChartConfigs] = useState(getInitialChartConfig());
  const [globalChartConfig, setGlobalChartConfig] = useState(
    initialGlobalChartConfig,
  );

  const saveScoping = useCallback(() => {
    const savedChartConfigs = { ...chartConfigs };
    if (savedChartConfigs[NEW_CHART_SCOPING_ID]) {
      delete savedChartConfigs[NEW_CHART_SCOPING_ID];
    }
    dispatch(
      saveChartConfiguration({
        chartConfiguration: savedChartConfigs,
        globalChartConfiguration: globalChartConfig,
      }),
    );
    closeModal();
  }, [chartConfigs, closeModal, dispatch, globalChartConfig]);

  const handleScopeUpdate = useCallback(
    ({ scope }: { scope: NativeFilterScope }) => {
      if (isDefined(currentChartId)) {
        setChartConfigs(prevConfig => ({
          ...prevConfig,
          [currentChartId]: {
            id: currentChartId,
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
        setChartConfigs(prevConfig =>
          getUpdatedGloballyScopedChartsInScope(
            prevConfig,
            globalChartsInScope,
          ),
        );
      }
    },
    [currentChartId, chartIds, layout],
  );

  const removeCustomScope = useCallback(
    (chartId: number) => {
      setChartConfigs(prevConfigs => {
        const newConfigs = { ...prevConfigs };
        if (chartId === NEW_CHART_SCOPING_ID) {
          delete newConfigs[NEW_CHART_SCOPING_ID];
        } else {
          newConfigs[chartId] = {
            id: chartId,
            crossFilters: {
              scope: GLOBAL_SCOPE_POINTER,
              chartsInScope: globalChartConfig.chartsInScope.filter(
                id => id !== chartId,
              ),
            },
          };
        }
        return newConfigs;
      });
      if (currentChartId === chartId) {
        setCurrentChartId(undefined);
      }
    },
    [currentChartId, globalChartConfig.chartsInScope],
  );

  const addNewCustomScope = useCallback(() => {
    setCurrentChartId(NEW_CHART_SCOPING_ID);
    if (!chartConfigs[NEW_CHART_SCOPING_ID]) {
      setChartConfigs(prevConfigs => ({
        ...prevConfigs,
        [NEW_CHART_SCOPING_ID]: {
          id: NEW_CHART_SCOPING_ID,
          crossFilters: {
            scope: globalChartConfig.scope,
            chartsInScope: globalChartConfig.chartsInScope,
          },
        },
      }));
    }
  }, [chartConfigs, globalChartConfig.chartsInScope, globalChartConfig.scope]);

  const handleSelectChange = useCallback(
    (newChartId: number) => {
      if (isDefined(currentChartId)) {
        const currentScope = !isCrossFilterScopeGlobal(
          chartConfigs[currentChartId]?.crossFilters.scope,
        )
          ? (chartConfigs[currentChartId].crossFilters
              .scope as NativeFilterScope)
          : globalChartConfig.scope;
        const newScope = {
          rootPath: currentScope.rootPath,
          excluded: [
            ...currentScope.excluded.filter(id => id !== currentChartId),
            newChartId,
          ],
        };
        const newCrossFiltersConfig = {
          id: newChartId,
          crossFilters: {
            scope: newScope,
            chartsInScope: getChartIdsInFilterScope(newScope, chartIds, layout),
          },
        };

        setChartConfigs(prevConfig => {
          const newConfig = {
            ...prevConfig,
            [newChartId]: newCrossFiltersConfig,
          };
          if (currentChartId === NEW_CHART_SCOPING_ID) {
            delete newConfig[NEW_CHART_SCOPING_ID];
          } else {
            newConfig[currentChartId] = {
              id: currentChartId,
              crossFilters: {
                scope: GLOBAL_SCOPE_POINTER,
                chartsInScope: globalChartConfig.chartsInScope.filter(
                  id => id !== currentChartId,
                ),
              },
            };
          }
          return newConfig;
        });

        setCurrentChartId(newChartId);
      }
    },
    [
      chartConfigs,
      chartIds,
      currentChartId,
      globalChartConfig.chartsInScope,
      globalChartConfig.scope,
      layout,
    ],
  );

  const scope = useMemo(() => {
    const globalScope = globalChartConfig.scope;
    if (!isDefined(currentChartId)) {
      return globalScope;
    }
    if (
      isCrossFilterScopeGlobal(
        chartConfigs[currentChartId]?.crossFilters?.scope,
      )
    ) {
      return getActualScopeFromGlobalScope(currentChartId, globalScope);
    }
    return chartConfigs[currentChartId]?.crossFilters
      ?.scope as NativeFilterScope;
  }, [chartConfigs, currentChartId, globalChartConfig.scope]);

  return (
    <Modal
      onHide={closeModal}
      show={isVisible}
      title={t('Cross-filtering scoping')}
      onHandledPrimaryAction={saveScoping}
      primaryButtonName={t('Save')}
      responsive
      destroyOnClose
      bodyStyle={{
        padding: 0,
        height: 700,
      }}
    >
      <ScopingModalContent
        chartConfigs={chartConfigs}
        currentScope={scope}
        onScopeUpdate={handleScopeUpdate}
        chartId={currentChartId}
        setCurrentChartId={setCurrentChartId}
        onSelectChange={handleSelectChange}
        removeCustomScope={removeCustomScope}
        addNewCustomScope={addNewCustomScope}
      />
    </Modal>
  );
};
