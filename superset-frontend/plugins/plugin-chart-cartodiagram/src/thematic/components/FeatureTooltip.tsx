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
import { styled } from '@superset-ui/core';
import { useEffect, useRef } from 'react';
import { Feature, MapBrowserEvent } from 'ol';
import { FeatureTooltipProps } from '../types';
import {
  setTooltipInvisible,
  renderTooltip,
  setTooltipVisible,
  positionTooltip,
  getTemplateProps,
  getHoverFeature,
  clearTooltip,
} from '../util/tooltipUtil';

export const FeatureTooltip = (props: FeatureTooltipProps) => {
  const {
    className,
    olMap,
    tooltipTemplate,
    dataLayers,
    geomColumn,
    mapId,
    columns,
  } = props;

  const tooltipRef = useRef<HTMLDivElement>(null);
  const currentFeatureRef = useRef<Feature | undefined>(undefined);

  useEffect(() => {
    const onPointerMove = (evt: MapBrowserEvent<any>) => {
      const infoTooltip = tooltipRef.current;
      const isEmptyTemplate = tooltipTemplate === '';

      if (!infoTooltip || isEmptyTemplate) {
        return;
      }

      if (evt.dragging) {
        setTooltipInvisible(infoTooltip);
        clearTooltip(infoTooltip);
        currentFeatureRef.current = undefined;
        return;
      }

      const pixel = olMap.getEventPixel(evt.originalEvent);
      const { clientX, clientY, target, view } = evt.originalEvent;
      const { innerHeight, innerWidth } = view;

      const feature = target.closest('.ol-control')
        ? undefined
        : getHoverFeature(pixel, olMap, dataLayers || []);

      if (feature) {
        positionTooltip(infoTooltip, clientX, clientY, innerWidth, innerHeight);

        const shouldRenderTooltip = feature !== currentFeatureRef.current;
        if (shouldRenderTooltip) {
          const ignoreProps = ['geometry', geomColumn];
          const templateProps = getTemplateProps(feature, ignoreProps, columns);

          renderTooltip(tooltipTemplate, templateProps, infoTooltip);
          setTooltipVisible(infoTooltip);
        }
      } else {
        setTooltipInvisible(infoTooltip);
        clearTooltip(infoTooltip);
      }
      currentFeatureRef.current = feature;
    };

    const onMouseLeave = () => {
      if (!tooltipRef.current) {
        return;
      }
      setTooltipInvisible(tooltipRef.current);
      clearTooltip(tooltipRef.current);
      currentFeatureRef.current = undefined;
    };

    olMap.on('pointermove', onPointerMove);
    document
      .querySelector(`#${mapId}`)
      ?.addEventListener('mouseleave', onMouseLeave);

    return () => {
      olMap.un('pointermove', onPointerMove);
      document
        .querySelector(`#${mapId}`)
        ?.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [
    tooltipRef,
    currentFeatureRef,
    olMap,
    tooltipTemplate,
    dataLayers,
    geomColumn,
    mapId,
    columns,
  ]);

  return <div ref={tooltipRef} className={className} />;
};

// eslint-disable-next-line theme-colors/no-literal-colors
export const StyledFeatureTooltip = styled(FeatureTooltip)`
  position: fixed;
  display: inline-block;
  height: auto;
  width: auto;
  z-index: 100;
  background-color: #333;
  color: #fff;
  text-align: left;
  border-radius: 4px;
  padding: 5px;
  transform: translateX(10px);
  visibility: hidden;
  pointer-events: none;
`;
