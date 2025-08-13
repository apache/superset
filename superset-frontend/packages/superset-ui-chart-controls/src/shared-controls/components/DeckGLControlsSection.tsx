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
import { FC } from 'react';
import { t } from '@superset-ui/core';
import { Switch, Select, Input, Slider } from 'antd';
import { Row, Col } from '@superset-ui/core/components';

export interface DeckGLControlsSectionProps {
  layerType?:
    | 'scatter'
    | 'polygon'
    | 'path'
    | 'heatmap'
    | 'hex'
    | 'grid'
    | 'screengrid'
    | 'contour'
    | 'geojson'
    | 'arc';
  showViewport?: boolean;
  showMapStyle?: boolean;
  showColorScheme?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  showFilters?: boolean;
  showAnimation?: boolean;
  show3D?: boolean;
  showMultiplier?: boolean;
  showPointRadius?: boolean;
  showLineWidth?: boolean;
  showFillColor?: boolean;
  showStrokeColor?: boolean;
  showOpacity?: boolean;
  showCoverage?: boolean;
  showElevation?: boolean;
  values?: Record<string, any>;
  onChange?: (name: string, value: any) => void;
}

const DeckGLControlsSection: FC<DeckGLControlsSectionProps> = ({
  layerType = 'scatter',
  showViewport = true,
  showMapStyle = true,
  showColorScheme = true,
  showLegend = true,
  showTooltip = true,
  showFilters = true,
  showAnimation = false,
  show3D = false,
  showMultiplier = false,
  showPointRadius = false,
  showLineWidth = false,
  showFillColor = false,
  showStrokeColor = false,
  showOpacity = true,
  showCoverage = false,
  showElevation = false,
  values = {},
  onChange = () => {},
}) => (
  <div className="deckgl-controls-section">
    {/* Map Style */}
    {showMapStyle && (
      <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <label>{t('Map Style')}</label>
          <Select
            value={values.mapbox_style || 'mapbox://styles/mapbox/light-v9'}
            onChange={value => onChange('mapbox_style', value)}
            style={{ width: '100%' }}
            options={[
              {
                value: 'mapbox://styles/mapbox/streets-v11',
                label: t('Streets'),
              },
              { value: 'mapbox://styles/mapbox/light-v9', label: t('Light') },
              { value: 'mapbox://styles/mapbox/dark-v9', label: t('Dark') },
              {
                value: 'mapbox://styles/mapbox/satellite-v9',
                label: t('Satellite'),
              },
              {
                value: 'mapbox://styles/mapbox/outdoors-v11',
                label: t('Outdoors'),
              },
            ]}
          />
          <small className="text-muted">
            {t('Base map style for the visualization')}
          </small>
        </Col>
      </Row>
    )}

    {/* Viewport */}
    {showViewport && (
      <>
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label>{t('Zoom')}</label>
            <Slider
              value={values.zoom || 11}
              onChange={value => onChange('zoom', value)}
              min={0}
              max={22}
              step={0.1}
              marks={{ 0: '0', 11: '11', 22: '22' }}
            />
            <small className="text-muted">{t('Map zoom level')}</small>
          </Col>
        </Row>
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={values.autozoom || true}
                onChange={checked => onChange('autozoom', checked)}
              />
              {t('Auto Zoom')}
            </label>
            <small className="text-muted">
              {t('Automatically zoom to fit data bounds')}
            </small>
          </Col>
        </Row>
      </>
    )}

    {/* Point/Shape Size Controls */}
    {showPointRadius && (
      <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <label>{t('Point Radius')}</label>
          <Slider
            value={values.point_radius_fixed?.value || 1000}
            onChange={value =>
              onChange('point_radius_fixed', { type: 'fix', value })
            }
            min={1}
            max={10000}
            step={10}
          />
          <small className="text-muted">
            {t('Fixed radius for points in meters')}
          </small>
        </Col>
      </Row>
    )}

    {showLineWidth && (
      <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <label>{t('Line Width')}</label>
          <Slider
            value={values.line_width || 1}
            onChange={value => onChange('line_width', value)}
            min={1}
            max={50}
            step={1}
          />
          <small className="text-muted">{t('Width of lines in pixels')}</small>
        </Col>
      </Row>
    )}

    {/* 3D Controls */}
    {show3D && (
      <>
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={values.extruded || false}
                onChange={checked => onChange('extruded', checked)}
              />
              {t('3D')}
            </label>
            <small className="text-muted">{t('Show data in 3D')}</small>
          </Col>
        </Row>
        {values.extruded && showElevation && (
          <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
            <Col span={24}>
              <label>{t('Elevation')}</label>
              <Slider
                value={values.elevation || 0.1}
                onChange={value => onChange('elevation', value)}
                min={0}
                max={1}
                step={0.01}
              />
              <small className="text-muted">
                {t('Elevation multiplier for 3D rendering')}
              </small>
            </Col>
          </Row>
        )}
      </>
    )}

    {/* Opacity */}
    {showOpacity && (
      <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <label>{t('Opacity')}</label>
          <Slider
            value={values.opacity || 80}
            onChange={value => onChange('opacity', value)}
            min={0}
            max={100}
            step={1}
            marks={{ 0: '0%', 50: '50%', 100: '100%' }}
          />
          <small className="text-muted">{t('Layer opacity')}</small>
        </Col>
      </Row>
    )}

    {/* Coverage (for hex, grid) */}
    {showCoverage && (layerType === 'hex' || layerType === 'grid') && (
      <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <label>{t('Coverage')}</label>
          <Slider
            value={values.coverage || 1}
            onChange={value => onChange('coverage', value)}
            min={0}
            max={1}
            step={0.01}
          />
          <small className="text-muted">{t('Cell coverage radius')}</small>
        </Col>
      </Row>
    )}

    {/* Legend */}
    {showLegend && (
      <>
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label>{t('Legend Position')}</label>
            <Select
              value={values.legend_position || 'top_right'}
              onChange={value => onChange('legend_position', value)}
              style={{ width: '100%' }}
              options={[
                { value: 'top_left', label: t('Top left') },
                { value: 'top_right', label: t('Top right') },
                { value: 'bottom_left', label: t('Bottom left') },
                { value: 'bottom_right', label: t('Bottom right') },
              ]}
            />
          </Col>
        </Row>
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label>{t('Legend Format')}</label>
            <Input
              value={values.legend_format || ''}
              onChange={e => onChange('legend_format', e.target.value)}
              placeholder=".3s"
            />
            <small className="text-muted">
              {t('D3 number format for legend')}
            </small>
          </Col>
        </Row>
      </>
    )}

    {/* Filters */}
    {showFilters && (
      <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={values.filter_nulls || true}
              onChange={checked => onChange('filter_nulls', checked)}
            />
            {t('Filter Nulls')}
          </label>
          <small className="text-muted">
            {t('Filter out null values from data')}
          </small>
        </Col>
      </Row>
    )}

    {/* Tooltip */}
    {showTooltip && (
      <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <label>{t('Tooltip')}</label>
          <Input.TextArea
            value={values.js_tooltip || ''}
            onChange={e => onChange('js_tooltip', e.target.value)}
            placeholder={t('JavaScript tooltip generator')}
            rows={3}
          />
          <small className="text-muted">
            {t('JavaScript code for custom tooltip')}
          </small>
        </Col>
      </Row>
    )}

    {/* Animation */}
    {showAnimation && (
      <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={values.animation || false}
              onChange={checked => onChange('animation', checked)}
            />
            {t('Animate')}
          </label>
          <small className="text-muted">
            {t('Animate visualization over time')}
          </small>
        </Col>
      </Row>
    )}

    {/* Multiplier for some visualizations */}
    {showMultiplier && (
      <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <label>{t('Multiplier')}</label>
          <Slider
            value={values.multiplier || 1}
            onChange={value => onChange('multiplier', value)}
            min={0.01}
            max={10}
            step={0.01}
          />
          <small className="text-muted">{t('Value multiplier')}</small>
        </Col>
      </Row>
    )}
  </div>
);

export default DeckGLControlsSection;
