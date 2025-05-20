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
import { css, getChartBuildQueryRegistry, styled, t } from '@superset-ui/core';
import { Popover } from 'antd';
import { FeatureCollection, GeoJsonGeometryTypes } from 'geojson';
import { isEqual } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { EditItem, LayerConf, LayerConfigsControlProps } from './types';
import LayerConfigsPopoverContent from './LayerConfigsPopoverContent';
import FlatLayerTree from './FlatLayerTree';

export const StyledFlatLayerTree = styled(FlatLayerTree)`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;

    border: solid;
    border-width: 1px;
    border-radius: ${theme.borderRadius}px;
    border-color: ${theme.colors.grayscale.light2};

    & .add-layer-btn {
      display: flex;
      align-items: center;

      margin: 4px;

      color: ${theme.colors.grayscale.light1};
      font-size: ${theme.typography.sizes.s}px;
      font-weight: ${theme.typography.weights.normal};

      &:hover {
        background-color: ${theme.colors.grayscale.light4};
        border-color: ${theme.colors.grayscale.light2};
      }
    }

    & .ant-tree .ant-tree-treenode {
      display: block;
    }

    & .ant-tree-list-holder-inner {
      display: block !important;
    }

    & .ant-tree-node-content-wrapper {
      display: block;
    }

    & .ant-tree-node-content-wrapper:hover {
      background-color: unset;
    }
  `}
`;

const getEmptyEditItem = (): EditItem => ({
  idx: NaN,
  layerConf: {
    type: 'WMS',
    version: '1.3.0',
    title: '',
    url: '',
    layersParam: '',
  },
});

export const LayerConfigsControl: React.FC<LayerConfigsControlProps> = ({
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
    const newValue = value ? [...value] : [];
    newValue.splice(idx, 1);
    onChange(newValue);
  };

  const onPopoverClose = () => {
    setPopoverVisible(false);
  };

  const computeNewValue = (layerConf: LayerConf) => {
    const newValue = value ? [...value] : [];
    if (!editItem) {
      return undefined;
    }
    if (Number.isNaN(editItem.idx)) {
      newValue.unshift(layerConf);
    } else if (editItem) {
      newValue[editItem.idx] = layerConf;
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

  const onMoveLayer = (newConfigs: LayerConf[]) => {
    onChange(newConfigs);
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
        visible={popoverVisible}
        trigger="click"
        title={popoverTitle}
        placement="right"
        overlayStyle={{
          maxHeight: '700px',
          overflowY: 'auto',
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
          layerConfigs={value ?? []}
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
