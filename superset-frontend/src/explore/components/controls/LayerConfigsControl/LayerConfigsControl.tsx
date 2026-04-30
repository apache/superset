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
import { ControlHeader } from '@superset-ui/chart-controls';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Popover } from '@superset-ui/core/components';
import { getChartBuildQueryRegistry } from '@superset-ui/core/chart';
import { FeatureCollection, GeoJsonGeometryTypes } from 'geojson';
import { isEqual } from 'lodash';
import { nanoid } from 'nanoid';
import { FC, useEffect, useMemo, useState } from 'react';
import {
  EditItem,
  LayerConf,
  LayerConfigsControlProps,
  LayerConfWithId,
} from './types';
import LayerConfigsPopoverContent from './LayerConfigsPopoverContent';
import FlatLayerTree from './FlatLayerTree';

export const StyledFlatLayerTree = styled(FlatLayerTree)`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;

    border: solid;
    border-width: 1px;
    border-radius: ${theme.borderRadius}px;
    border-color: ${theme.colorBorderSecondary};
    padding: ${theme.sizeUnit}px;

    & .add-layer-btn {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      width: 100%;
      height: ${theme.sizeUnit * 6}px;
      margin-bottom: ${theme.sizeUnit}px;
      padding-left: ${theme.sizeUnit}px;
      padding-right: 0;
      background-color: transparent;
      border: dashed 1px ${theme.colorSplit};
      border-radius: ${theme.borderRadius}px;
      cursor: pointer;
      box-shadow: none;

      color: ${theme.colorTextSecondary};
      font-size: ${theme.fontSizeSM}px;
      font-weight: inherit;

      &:focus {
        border-color: ${theme.colorSplit};
      }

      &:hover {
        background-color: ${theme.colorFillSecondary};
        border-color: ${theme.colorSplit};
      }

      &:active {
        background-color: ${theme.colorFillTertiary};
        border-color: ${theme.colorSplit};
      }

      .anticon {
        margin-right: ${theme.sizeUnit}px;
      }
    }
  `}
`;

const ensureLayerId = (layerConf: LayerConf): LayerConfWithId =>
  layerConf.id
    ? { ...layerConf, id: layerConf.id }
    : { ...layerConf, id: nanoid() };

const getEmptyEditItem = (): EditItem => ({
  idx: NaN,
  layerConf: {
    id: nanoid(),
    type: 'WMS',
    version: '1.3.0',
    title: '',
    url: '',
    layersParam: '',
  },
});

export const LayerConfigsControl: FC<LayerConfigsControlProps> = ({
  value,
  onChange = () => {},
  name,
  label,
  description,
  formData,
  formWatchers,
  featureCollectionTransformer,
  renderTrigger,
  hovered,
  enableDataLayer = false,
  colTypeMapping,
  validationErrors,
}) => {
  const [popoverVisible, setPopoverVisible] = useState<boolean>(false);
  const [editItem, setEditItem] = useState<EditItem>(getEmptyEditItem());
  const [currentFormData, setCurrentFormData] = useState(formData);
  const [chartData, setChartData] = useState<FeatureCollection | undefined>();

  /**
   * We only want to watch for changes for a dynamic set of properties
   * of the formData. To prevent unwanted http requests in the render cycles,
   * we use the proxy currentFormData instead.
   */
  useEffect(() => {
    setCurrentFormData(oldCurrentFormData => {
      if (!formWatchers) {
        return oldCurrentFormData;
      }

      const hasChanges = formWatchers.some(
        watcher => !isEqual(formData?.[watcher], oldCurrentFormData?.[watcher]),
      );
      if (hasChanges) {
        return formData;
      }
      return oldCurrentFormData;
    });
  }, [formData, formWatchers]);

  useEffect(() => {
    if (!currentFormData || !enableDataLayer) {
      return;
    }
    const buildQueryRegistry = getChartBuildQueryRegistry();
    const chartQueryBuilder = buildQueryRegistry.get(
      currentFormData.viz_type,
    ) as any;
    const chartQuery = chartQueryBuilder(currentFormData);
    const fetchChartData = async () => {
      const body = JSON.stringify(chartQuery);
      const response = await fetch('/api/v1/chart/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      });
      if (!response.ok) {
        return;
      }
      const responseJson = await response.json();
      let { data } = responseJson.result[0];

      if (featureCollectionTransformer) {
        data = featureCollectionTransformer(data, currentFormData);
      }

      setChartData(data);
    };

    fetchChartData();
  }, [currentFormData, enableDataLayer, featureCollectionTransformer]);

  const layerConfigs = useMemo<LayerConfWithId[]>(
    () => (value ?? []).map(ensureLayerId),
    [value],
  );

  const onAddClick = () => {
    setEditItem(getEmptyEditItem());
    setPopoverVisible(true);
  };

  const onEditClick = (layerConf: LayerConf, idx: number) => {
    if (popoverVisible) {
      return;
    }
    setEditItem({
      idx,
      layerConf: { ...layerConf },
    });
    setPopoverVisible(true);
  };

  const onRemoveClick = (idx: number) => {
    const newValue = [...layerConfigs];
    newValue.splice(idx, 1);
    onChange(newValue);
  };

  const onPopoverClose = () => {
    setPopoverVisible(false);
  };

  const computeNewValue = (layerConf: LayerConf) => {
    const newValue = [...layerConfigs];
    if (!editItem) {
      return undefined;
    }
    if (Number.isNaN(editItem.idx)) {
      newValue.unshift(ensureLayerId(layerConf));
    } else if (editItem) {
      newValue[editItem.idx] = ensureLayerId(layerConf);
    }
    return newValue;
  };

  const onPopoverSave = (layerConf: LayerConf) => {
    const newValue = computeNewValue(layerConf);
    setPopoverVisible(false);
    if (!newValue) {
      return;
    }
    onChange(newValue);
  };

  const onMoveLayer = (dragIndex: number, hoverIndex: number) => {
    if (dragIndex === hoverIndex) {
      return;
    }
    const newConfigs = [...layerConfigs];
    const [draggedLayer] = newConfigs.splice(dragIndex, 1);
    if (!draggedLayer) {
      return;
    }
    newConfigs.splice(hoverIndex, 0, draggedLayer);
    onChange(newConfigs.map(ensureLayerId));
  };

  const popoverTitle = editItem.layerConf.title
    ? editItem.layerConf.title
    : t('Add Layer');
  const controlHeaderProps = {
    name,
    label,
    description,
    renderTrigger,
    hovered,
    validationErrors,
  };

  const geometryTypes = useMemo(() => {
    if (!chartData) {
      return [
        'Point',
        'MultiPoint',
        'LineString',
        'MultiLineString',
        'Polygon',
        'MultiPolygon',
      ] as GeoJsonGeometryTypes[];
    }
    const geomTypes = chartData.features.map(f => f.geometry.type);
    return [...new Set(geomTypes)];
  }, [chartData]);

  return (
    <div>
      <ControlHeader {...controlHeaderProps} />
      <Popover
        open={popoverVisible}
        trigger="click"
        title={popoverTitle}
        placement="right"
        styles={{
          root: {
            maxWidth: '400px',
            maxHeight: '700px',
            overflowY: 'auto',
          },
        }}
        content={
          <LayerConfigsPopoverContent
            layerConf={editItem.layerConf}
            onClose={onPopoverClose}
            onSave={onPopoverSave}
            enableDataLayer={enableDataLayer}
            colTypeMapping={colTypeMapping}
            dataFeatureCollection={chartData}
            includedGeometryTypes={geometryTypes}
          />
        }
      >
        <StyledFlatLayerTree
          layerConfigs={layerConfigs}
          onMoveLayer={onMoveLayer}
          onEditLayer={onEditClick}
          onRemoveLayer={onRemoveClick}
          onAddLayer={onAddClick}
          draggable={!popoverVisible}
        />
      </Popover>
    </div>
  );
};

export default LayerConfigsControl;
