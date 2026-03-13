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

import type { CallbackDataParams } from 'echarts/types/src/util/types';
import {
  QueryFormColumn,
  QueryFormMetric,
  getColumnLabel,
  getMetricLabel,
} from '@superset-ui/core';
import { TOOLTIP_OVERFLOW_MARGIN, TOOLTIP_POINTER_MARGIN } from '../constants';
import { Refs } from '../types';

export function getDefaultTooltip(refs: Refs) {
  return {
    appendToBody: true,
    borderColor: 'transparent',
    // CSS hack applied on this class to resolve https://github.com/apache/superset/issues/30058
    className: 'echarts-tooltip',
    // allow scrolling inside tooltip without re-triggering the chart
    enterable: true,
    // keep within viewport and above header; enable internal scroll
    confine: true,
    // optional: reduce flicker when moving in/out of tooltip
    hideDelay: 50,
    position: (
      canvasMousePos: [number, number],
      params: CallbackDataParams,
      tooltipDom: HTMLDivElement | null,
      rect: any,
      sizes: { contentSize: [number, number]; viewSize: [number, number] },
    ) => {
      // Algorithm partially based on this snippet:
      // https://github.com/apache/echarts/issues/5004#issuecomment-559668309

      const divRect = refs.divRef?.current?.getBoundingClientRect();
      const mouseX = canvasMousePos[0] + (divRect?.x || 0);
      const mouseY = canvasMousePos[1] + (divRect?.y || 0);
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const tooltipWidth = sizes.contentSize[0];
      const tooltipHeight = sizes.contentSize[1];

      // Cap tooltip height to reduce blocking adjacent elements
      const maxAllowedHeight = Math.min(800, Math.floor(viewportHeight * 0.8));
      const needsScrolling = tooltipHeight > maxAllowedHeight;

      if (tooltipDom) {
        tooltipDom.style.maxHeight = `${maxAllowedHeight}px`;
        tooltipDom.style.overflow = 'auto';
        // Only enable pointer events when tooltip is scrollable
        // This prevents blocking adjacent chart elements when scrolling isn't needed
        tooltipDom.style.pointerEvents = needsScrolling ? 'auto' : 'none';
      }

      const effectiveTooltipHeight = Math.min(tooltipHeight, maxAllowedHeight);
      let xPos: number;
      let yPos: number;

      // For scrollable tooltips, position further away horizontally to avoid blocking chart navigation
      const horizontalMargin = needsScrolling
        ? TOOLTIP_POINTER_MARGIN * 3
        : TOOLTIP_POINTER_MARGIN;

      // Determine if cursor is in the right half of the chart to intelligently position tooltip
      const chartWidth = divRect?.width || viewportWidth;
      const cursorXInChart = canvasMousePos[0];
      const isInRightHalfOfChart = cursorXInChart > chartWidth / 2;

      // Position tooltip on the left when in right half, right when in left half
      // This prevents blocking chart navigation
      if (isInRightHalfOfChart) {
        xPos = mouseX - horizontalMargin - tooltipWidth;

        // If tooltip would go off left edge of viewport, push it back in
        if (xPos <= 0) {
          xPos = TOOLTIP_OVERFLOW_MARGIN;
        }
      } else {
        xPos = mouseX + horizontalMargin;

        // If tooltip would go off right edge of viewport, position on left instead
        if (xPos + tooltipWidth >= viewportWidth) {
          xPos = mouseX - horizontalMargin - tooltipWidth;

          // If still overflowing left edge, clamp to margin
          if (xPos <= 0) {
            xPos = TOOLTIP_OVERFLOW_MARGIN;
          }
        }
      }

      // Position tooltip above cursor, or below if no space
      yPos = mouseY - TOOLTIP_POINTER_MARGIN - effectiveTooltipHeight;

      // The tooltip is overflowing past the top edge of the window
      if (yPos <= 0) {
        // Attempt to place the tooltip to the bottom of the mouse position
        yPos = mouseY + TOOLTIP_POINTER_MARGIN;

        // The tooltip is overflowing past the bottom edge of the window
        if (yPos + effectiveTooltipHeight >= viewportHeight)
          // Place the tooltip a fixed distance from the top edge of the window
          yPos = TOOLTIP_OVERFLOW_MARGIN;
      }

      // Return the position (converted back to a relative position on the canvas)
      return [xPos - (divRect?.x || 0), yPos - (divRect?.y || 0)];
    },
  };
}

export function getTooltipLabels({
  tooltipMetrics,
  tooltipColumns,
}: {
  tooltipMetrics?: QueryFormMetric[];
  tooltipColumns?: QueryFormColumn[];
}) {
  return [
    ...(tooltipMetrics ?? []).map(v => getMetricLabel(v)),
    ...(tooltipColumns ?? []).map(v => getColumnLabel(v)),
  ];
}
