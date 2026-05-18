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
import {
  CSSProperties,
  FC,
  MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { extent } from 'd3-array';
import { rgb } from 'd3-color';
import { geoMercator, geoPath } from 'd3-geo';
import {
  getNumberFormatter,
  getSequentialSchemeRegistry,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { CountryMapTransformedProps } from './types';

interface FeatureProps {
  iso_3166_2?: string;
  adm0_a3?: string;
  name?: string;
  [k: string]: unknown;
}

type Feature = GeoJSON.Feature<GeoJSON.Geometry, FeatureProps>;

interface TooltipState {
  x: number;
  y: number;
  name: string;
  value: string | null;
}

const containerStyle: CSSProperties = {
  position: 'relative',
  fontFamily: 'sans-serif',
};

/**
 * Pick the property name on a feature that identifies it for data
 * lookups. Admin 1 uses `iso_3166_2`; Admin 0 uses `adm0_a3`. Some
 * dissolved/composite features may set their own `iso_3166_2`.
 */
function featureKey(feature: Feature): string {
  const p = feature.properties || {};
  return p.iso_3166_2 || p.adm0_a3 || '';
}

function featureName(feature: Feature, language: string): string {
  const p = feature.properties || {};
  // Try language-specific NAME_<lang> first, fall back to `name`.
  const langKey = `name_${language.toLowerCase()}`;
  return (p[langKey] as string) || p.name || '';
}

/**
 * Filter a feature collection by include/exclude lists + the
 * flying-islands toggle.
 *
 * - includes: if non-empty, keep ONLY features whose key is in this list
 * - excludes: drop features whose key is in this list
 * - showFlyingIslands: when false, drop features tagged as "flying" (the
 *   build pipeline doesn't currently tag these in feature properties; for
 *   the POC we treat the flag as a no-op until tagging is added)
 */
function filterFeatures(
  features: Feature[],
  includes: string[],
  excludes: string[],
): Feature[] {
  const incSet = new Set(includes);
  const excSet = new Set(excludes);
  return features.filter(f => {
    const k = featureKey(f);
    if (incSet.size > 0 && !incSet.has(k)) return false;
    if (excSet.has(k)) return false;
    return true;
  });
}

const CountryMap: FC<CountryMapTransformedProps> = props => {
  const {
    width,
    height,
    geoJsonUrl,
    data,
    formData,
    metricName,
    numberFormat,
    linearColorScheme,
  } = props;

  const theme = useTheme();
  // Each token has an explicit literal fallback. Without these, themes
  // that don't expose a given antd token leave the corresponding
  // `setAttribute('fill', undefined)` and the SVG defaults the path's
  // fill to black — which is why the chart was rendering as a solid
  // black box on the ephemeral build.
  const colors = {
    fillFallback: theme.colorFillTertiary || '#f0f0f0',
    schemeFallback: theme.colorFill || '#d9d9d9',
    hoverFallback: theme.colorFillSecondary || '#bfbfbf',
    stroke: theme.colorBorder || '#ffffff',
    tooltipBg: theme.colorBgSpotlight || 'rgba(0, 0, 0, 0.85)',
    tooltipFg: theme.colorTextLightSolid || '#ffffff',
    errorFg: theme.colorErrorText || '#cf1322',
    loadingFg: theme.colorTextSecondary || '#8c8c8c',
  };
  const tooltipStyle: CSSProperties = {
    position: 'absolute',
    pointerEvents: 'none',
    background: colors.tooltipBg,
    color: colors.tooltipFg,
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 12,
    whiteSpace: 'nowrap',
    transform: 'translate(-50%, -120%)',
    zIndex: 10,
    opacity: 0.9,
  };

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // ---- Load GeoJSON ----------------------------------------------------
  useEffect(() => {
    if (!geoJsonUrl) {
      setError(
        'No GeoJSON URL resolved (check worldview / admin_level / country).',
      );
      setGeo(null);
      return;
    }
    setError(null);
    let cancelled = false;
    fetch(geoJsonUrl)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${geoJsonUrl}`);
        return r.json();
      })
      .then((g: GeoJSON.FeatureCollection) => {
        if (!cancelled) setGeo(g);
      })
      .catch(e => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [geoJsonUrl]);

  // ---- Compute filtered feature set ------------------------------------
  const filteredFeatures = useMemo<Feature[]>(() => {
    if (!geo) return [];
    return filterFeatures(
      geo.features as Feature[],
      formData.region_includes ?? [],
      formData.region_excludes ?? [],
    );
  }, [geo, formData.region_includes, formData.region_excludes]);

  // ---- Color scale -----------------------------------------------------
  const colorByKey = useMemo<Record<string, string>>(() => {
    if (!data.length || !metricName) return {};
    const numericData = data
      .map(d => ({
        key: String(
          d[Object.keys(d).find(k => k !== metricName) || 'key'] ?? '',
        ),
        value:
          typeof d[metricName] === 'number' ? (d[metricName] as number) : NaN,
      }))
      .filter(d => Number.isFinite(d.value));
    if (!numericData.length) return {};

    const [lo, hi] = extent(numericData, d => d.value) as [number, number];
    const scheme = linearColorScheme
      ? getSequentialSchemeRegistry().get(linearColorScheme)
      : null;
    const linear = scheme
      ? scheme.createLinearScale([lo, hi])
      : () => colors.schemeFallback;

    const out: Record<string, string> = {};
    numericData.forEach(d => {
      out[d.key] = linear(d.value) ?? colors.schemeFallback;
    });
    return out;
  }, [data, metricName, linearColorScheme, colors.schemeFallback]);

  const formatter = useMemo(
    () =>
      numberFormat
        ? getNumberFormatter(numberFormat)
        : (n: number) => String(n),
    [numberFormat],
  );

  // ---- Render ----------------------------------------------------------
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !filteredFeatures.length) return undefined;

    // Clear previous render
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Compute projection that fits the rendered feature set
    // (NOT the original geo — fit-to-selection).
    const featureCollection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: filteredFeatures,
    };
    const projection = geoMercator().fitSize(
      [width, height],
      featureCollection,
    );
    const path = geoPath(projection);

    const ns = 'http://www.w3.org/2000/svg';

    // Background rect — clicking it zooms back out.
    const bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('width', String(width));
    bg.setAttribute('height', String(height));
    bg.setAttribute('fill', 'transparent');
    bg.style.cursor = 'pointer';
    svg.appendChild(bg);

    const g = document.createElementNS(ns, 'g');
    g.style.transition = 'transform 600ms ease-in-out';
    svg.appendChild(g);

    // Click-to-zoom state lives on the svg element so the background
    // click handler can read/clear it without React state churn.
    let zoomedFeature: Feature | null = null;
    const setTransform = (feature: Feature | null) => {
      if (!feature) {
        g.setAttribute('transform', '');
        zoomedFeature = null;
        return;
      }
      const centroid = path.centroid(feature);
      if (!centroid || centroid.some(Number.isNaN)) return;
      const k = 4;
      const tx = width / 2 - centroid[0] * k;
      const ty = height / 2 - centroid[1] * k;
      g.setAttribute('transform', `translate(${tx}, ${ty}) scale(${k})`);
      zoomedFeature = feature;
    };
    bg.addEventListener('click', () => setTransform(null));

    filteredFeatures.forEach(feature => {
      const d = path(feature);
      if (!d) return;
      const key = featureKey(feature);
      const fill = colorByKey[key] || colors.fillFallback;
      const el = document.createElementNS(ns, 'path');
      el.setAttribute('d', d);
      el.setAttribute('fill', fill);
      el.setAttribute('stroke', colors.stroke);
      el.setAttribute('stroke-width', '0.5');
      el.setAttribute('vector-effect', 'non-scaling-stroke');
      el.style.cursor = 'pointer';
      el.style.transition = 'fill 120ms';

      el.addEventListener('mouseenter', () => {
        const c = colorByKey[key];
        const darker = c ? rgb(c).darker(0.5).toString() : colors.hoverFallback;
        el.setAttribute('fill', darker);
      });
      el.addEventListener('mouseleave', () => {
        el.setAttribute('fill', colorByKey[key] || colors.fillFallback);
        setTooltip(null);
      });
      el.addEventListener('click', (event: globalThis.MouseEvent) => {
        event.stopPropagation();
        setTransform(zoomedFeature === feature ? null : feature);
      });
      el.addEventListener('mousemove', (event: globalThis.MouseEvent) => {
        const rect = svg.getBoundingClientRect();
        const dataRow = data.find(d => {
          const idCol = Object.keys(d).find(k => k !== metricName) || 'key';
          return String(d[idCol]) === key;
        });
        const value =
          dataRow && metricName && typeof dataRow[metricName] === 'number'
            ? formatter(dataRow[metricName] as number)
            : null;
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          name: featureName(feature, formData.name_language || 'en'),
          value,
        });
      });

      g.appendChild(el);
    });

    return () => {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
    };
  }, [
    filteredFeatures,
    width,
    height,
    colorByKey,
    data,
    metricName,
    formatter,
    formData.name_language,
  ]);

  if (error) {
    return (
      <div
        style={{
          ...containerStyle,
          width,
          height,
          padding: 16,
          color: colors.errorFg,
        }}
      >
        {t('Error loading map:')} {error}
      </div>
    );
  }

  return (
    <div style={{ ...containerStyle, width, height }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ display: 'block' }}
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onMouseLeave={(_e: ReactMouseEvent) => setTooltip(null)}
      />
      {tooltip && (
        <div style={{ ...tooltipStyle, left: tooltip.x, top: tooltip.y }}>
          <strong>{tooltip.name}</strong>
          {tooltip.value !== null && (
            <>
              <br />
              {tooltip.value}
            </>
          )}
        </div>
      )}
      {!geo && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            fontSize: 11,
            color: colors.loadingFg,
          }}
        >
          {t('Loading map…')}
        </div>
      )}
    </div>
  );
};

export default CountryMap;
