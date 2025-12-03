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
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { t, DataMask, ExtraFormData } from '@superset-ui/core';
import { useTheme } from '@apache-superset/core/ui';
import {
  Select,
  FormItem,
  Tooltip,
  Icons,
  Flex,
} from '@superset-ui/core/components';
import { useSelector } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import { PluginDeckglLayerVisibilityProps } from './types';
import { useDeckLayerMetadata } from './useDeckLayerMetadata';
import { FilterPluginStyle } from '../common';
import { Slice } from 'src/dashboard/types';

type SliceEntitiesState = {
  sliceEntities?: {
    slices: Record<number, Slice>;
  };
};

type DataMaskState = Record<
  string,
  DataMask & {
    extraFormData?: ExtraFormData & { visible_deckgl_layers?: number[] };
  }
>;

const EMPTY_OBJECT = {};

const selectAllLayerIds = createSelector(
  [
    (state: SliceEntitiesState) =>
      state.sliceEntities?.slices || (EMPTY_OBJECT as Record<number, Slice>),
  ],
  slices => {
    const ids: number[] = [];
    Object.values(slices).forEach(slice => {
      if (slice.form_data?.viz_type === 'deck_multi') {
        const deckSlices = slice.form_data.deck_slices as number[] | undefined;
        if (deckSlices && Array.isArray(deckSlices)) {
          ids.push(...deckSlices);
        }
      }
    });
    return [...new Set(ids)];
  },
);

export default function DeckglLayerVisibilityCustomizationPlugin(
  props: PluginDeckglLayerVisibilityProps,
) {
  const { formData, filterState, setDataMask, width, height } = props;
  const theme = useTheme();
  const [hiddenLayers, setHiddenLayers] = useState<number[]>(
    filterState?.value || [],
  );
  const hasInitialized = useRef(false);

  const allLayerIds = useSelector(selectAllLayerIds);
  const dataMask = useSelector(
    (state: { dataMask?: DataMaskState }) =>
      state.dataMask || (EMPTY_OBJECT as DataMaskState),
  );

  const visibleDeckLayersFromRedux = useMemo(() => {
    const layerVisibilityFilter = Object.values(dataMask).find(
      mask => mask?.extraFormData?.visible_deckgl_layers !== undefined,
    );
    return layerVisibilityFilter?.extraFormData?.visible_deckgl_layers;
  }, [dataMask]);

  const { layers: apiLayers, isLoading: isLoadingMetadata } =
    useDeckLayerMetadata(allLayerIds);

  const allLayerIdsFromApi = useMemo(
    () => apiLayers.map(layer => layer.sliceId),
    [apiLayers],
  );

  useEffect(() => {
    if (
      !hasInitialized.current &&
      formData.defaultToAllLayersVisible &&
      apiLayers.length > 0 &&
      !filterState?.value &&
      visibleDeckLayersFromRedux === undefined
    ) {
      hasInitialized.current = true;
      setHiddenLayers([]);

      setDataMask({
        filterState: {
          value: [],
        },
        extraFormData: {
          visible_deckgl_layers: allLayerIdsFromApi,
        } as ExtraFormData,
      });
    }
  }, [
    formData.defaultToAllLayersVisible,
    apiLayers.length,
    filterState?.value,
    visibleDeckLayersFromRedux,
    allLayerIdsFromApi,
    setDataMask,
  ]);

  const handleLayerChange = useCallback(
    (selectedHiddenLayers: number[]) => {
      setHiddenLayers(selectedHiddenLayers);

      const visibleLayers = allLayerIdsFromApi.filter(
        id => !selectedHiddenLayers.includes(id),
      );

      setDataMask({
        filterState: {
          value: selectedHiddenLayers,
        },
        extraFormData: {
          visible_deckgl_layers: visibleLayers,
        } as ExtraFormData,
      });
    },
    [allLayerIdsFromApi, setDataMask],
  );

  const selectOptions = useMemo(
    () =>
      apiLayers.map(layer => ({
        label: `${layer.name} (${layer.type})`,
        value: layer.sliceId,
      })),
    [apiLayers],
  );

  if (isLoadingMetadata && apiLayers.length === 0) {
    return (
      <FilterPluginStyle height={height} width={width}>
        <div>{t('Loading deck.gl layers...')}</div>
      </FilterPluginStyle>
    );
  }

  return (
    <FilterPluginStyle height={height} width={width}>
      {apiLayers.length === 0 ? (
        <div>{t('No deck.gl multi layer charts found in this dashboard.')}</div>
      ) : (
        <FormItem
          label={
            <Flex gap={theme.sizeUnit}>
              <span>{t('Exclude layers (deck.gl)')}</span>
              <Tooltip
                title={t(
                  'Choose layers to hide from all deck.gl Multiple Layer charts in this dashboard.',
                )}
              >
                <span className="tooltip-icon">
                  <Icons.InfoCircleOutlined
                    iconSize="m"
                    iconColor={theme.colorIcon}
                  />
                </span>
              </Tooltip>
            </Flex>
          }
        >
          <Select
            mode="multiple"
            value={hiddenLayers}
            onChange={handleLayerChange}
            options={selectOptions}
            placeholder={t('Select layers to hide')}
            allowClear
          />
        </FormItem>
      )}
    </FilterPluginStyle>
  );
}
