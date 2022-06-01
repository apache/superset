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
import React, { useCallback, useState } from 'react';
import { css, t, getChartMetadataRegistry, styled } from '@superset-ui/core';
import { usePluginContext } from 'src/components/DynamicPlugins';
import Modal from 'src/components/Modal';
import { Type } from 'src/components/Label';
import Icons from 'src/components/Icons';
import { noOp } from 'src/utils/common';
import VizTypeGallery, {
  MAX_ADVISABLE_VIZ_GALLERY_WIDTH,
} from './VizTypeGallery';

interface VizTypeControlProps {
  description?: string;
  label?: string;
  name: string;
  onChange: (vizType: string | null) => void;
  value: string | null;
  labelType?: Type;
  isModalOpenInit?: boolean;
}

const FEATURED_CHARTS = [
  {
    name: 'echarts_timeseries_line',
    icon: <Icons.LineChartTile viewBox="0 0 16 16" />,
  },
  { name: 'table', icon: <Icons.TableChartTile viewBox="0 0 16 16" /> },
  {
    name: 'big_number',
    icon: <Icons.BigNumberChartTile viewBox="0 0 16 16" />,
  },
  { name: 'pie', icon: <Icons.PieChartTile viewBox="0 0 16 16" /> },
  {
    name: 'echarts_timeseries_bar',
    icon: <Icons.BarChartTile viewBox="0 0 16 16" />,
  },
  { name: 'echarts_area', icon: <Icons.AreaChartTile viewBox="0 0 16 16" /> },
];

const metadataRegistry = getChartMetadataRegistry();

export const VIZ_TYPE_CONTROL_TEST_ID = 'viz-type-control';

function VizSupportValidation({ vizType }: { vizType: string }) {
  const state = usePluginContext();
  if (state.loading || metadataRegistry.has(vizType)) {
    return null;
  }
  return (
    <div className="text-danger">
      <i className="fa fa-exclamation-circle text-danger" />{' '}
      <small>{t('This visualization type is not supported.')}</small>
    </div>
  );
}

const UnpaddedModal = styled(Modal)`
  .ant-modal-body {
    padding: 0;
  }
`;

/** Manages the viz type and the viz picker modal */
const VizTypeControl = ({
  value: initialValue,
  onChange = noOp,
  isModalOpenInit,
  labelType = 'default',
}: VizTypeControlProps) => {
  const { mountedPluginMetadata } = usePluginContext();
  const [showModal, setShowModal] = useState(!!isModalOpenInit);
  // a trick to force re-initialization of the gallery each time the modal opens,
  // ensuring that the modal always opens to the correct category.
  const [modalKey, setModalKey] = useState(0);
  const [selectedViz, setSelectedViz] = useState<string | null>(initialValue);

  const openModal = useCallback(() => {
    setShowModal(true);
  }, []);

  const onSubmit = useCallback(() => {
    onChange(selectedViz);
    setShowModal(false);
  }, [selectedViz, onChange]);

  const onCancel = useCallback(() => {
    setShowModal(false);
    setModalKey(key => key + 1);
    // make sure the modal re-opens to the last submitted viz
    setSelectedViz(initialValue);
  }, [initialValue]);

  const chartName = initialValue
    ? mountedPluginMetadata[initialValue]?.name || `${initialValue}`
    : t('Select Viz Type');

  return (
    <div>
      <div
        css={css`
          display: flex;
        `}
      >
        {FEATURED_CHARTS.map((featuredChart, index) => (
          <div
            css={css`
              padding-right: 4px;
            `}
            key={index}
          >
            {featuredChart.icon}
          </div>
        ))}
      </div>
      {initialValue && <VizSupportValidation vizType={initialValue} />}

      <UnpaddedModal
        show={showModal}
        onHide={onCancel}
        title={t('Select a visualization type')}
        primaryButtonName={t('Select')}
        disablePrimaryButton={!selectedViz}
        onHandledPrimaryAction={onSubmit}
        maxWidth={`${MAX_ADVISABLE_VIZ_GALLERY_WIDTH}px`}
        responsive
      >
        {/* When the key increments, it forces react to re-init the gallery component */}
        <VizTypeGallery
          key={modalKey}
          selectedViz={selectedViz}
          onChange={setSelectedViz}
        />
      </UnpaddedModal>
    </div>
  );
};

export default VizTypeControl;
