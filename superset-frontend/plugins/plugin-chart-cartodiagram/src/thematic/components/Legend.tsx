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
import { CloseOutlined } from '@ant-design/icons';
import { t } from '@superset-ui/core';
import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import Control from 'ol/control/Control.js';
import { LegendRenderer } from 'geostyler-legend';
import { Style } from 'geostyler-style';
import { LegendProps } from '../types';
import { isDataLayerConf } from '../../typeguards';

const legendContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  paddingLeft: '8px',
  paddingRight: '8px',
  maxHeight: '200px',
  overflow: 'auto',
};

const legendTitleStyle: CSSProperties = {
  fontWeight: '600',
  marginBottom: '8px',
};

const legendBtnStyle: CSSProperties = {
  display: 'block',
  margin: '1px',
  padding: '0',
  color: 'var(--ol-subtle-foreground-color)',
  fontWeight: 'bold',
  textDecoration: 'none',
  fontSize: 'inherit',
  textAlign: 'center',
  height: '1.375em',
  width: '1.375em',
  lineHeight: '0.4em',
  backgroundColor: 'var(--ol-background-color)',
  border: 'none',
  borderRadius: '2px',
};

export const Legend = (props: LegendProps) => {
  const { className, olMap, layerConfigs } = props;

  const legendRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const legendRenderer = useMemo(() => {
    const layerStyles = layerConfigs
      .filter(isDataLayerConf)
      .map(l => l.style)
      .filter(l => l !== undefined) as Style[];

    const renderer = new LegendRenderer({
      maxColumnWidth: 150,
      styles: layerStyles,
      size: [200, 0],
    });
    return renderer;
  }, [layerConfigs]);

  useEffect(() => {
    let legendControl: Control;
    if (legendRef.current) {
      legendControl = new Control({
        element: legendRef.current,
      });
      olMap.addControl(legendControl);
    }

    return () => {
      if (legendControl) {
        olMap.removeControl(legendControl);
      }
      legendRef.current = null;
    };
  }, [legendRef, olMap]);

  useEffect(() => {
    if (showLegend && contentRef.current) {
      legendRenderer.render(contentRef.current);
    }
  }, [contentRef, legendRenderer, showLegend]);

  const toggleLegend = () => {
    setShowLegend(currentShowLegend => !currentShowLegend);
  };

  const getControlStyle = () => {
    const style: CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      textAlign: 'right',
      bottom: '2.5em',
      right: '0.5em',
      maxWidth: 'calc(100% - 1.3em)',
    };
    if (showLegend) {
      style.background = 'var(--ol-background-color)';
      style.border = 'solid';
      style.borderWidth = '1px';
      style.borderColor = 'var(--ol-subtle-background-color)';
    }
    return style;
  };

  return (
    <div>
      <div
        ref={legendRef}
        className={`legend-control ol-unselectable ol-control ${
          showLegend ? 'legend-expanded' : ''
        } ${className}`}
        style={getControlStyle()}
      >
        {showLegend && (
          <div className="legend-container" style={legendContainerStyle}>
            <span className="legend-title" style={legendTitleStyle}>
              {t('Legend')}
            </span>
            <div ref={contentRef} />
          </div>
        )}
        <button
          className="legend-btn"
          style={legendBtnStyle}
          type="button"
          onClick={toggleLegend}
          title={t('Legend')}
        >
          {showLegend ? <CloseOutlined /> : 'L'}
        </button>
      </div>
    </div>
  );
};
