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
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import rison from 'rison';
import {
  Button,
  AsyncSelect,
  EmptyState,
  ColorPicker,
  Typography,
} from '@superset-ui/core/components';
import {
  SupersetClient,
  getCategoricalSchemeRegistry,
  getChartMetadataRegistry,
  validateNonEmpty,
  isValidExpression,
  getColumnLabel,
  VizType,
  type QueryFormColumn,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { styled, useTheme } from '@apache-superset/core/theme';
import { logging } from '@apache-superset/core/utils';
import SelectControl from 'src/explore/components/controls/SelectControl';
import TextControl from 'src/explore/components/controls/TextControl';
import CheckboxControl from 'src/explore/components/controls/CheckboxControl';
import PopoverSection from '@superset-ui/core/components/PopoverSection';
import ControlHeader from 'src/explore/components/ControlHeader';
import { CONTROL_SECTIONS_ID } from 'src/explore/constants';
import { ensureAppRoot } from 'src/utils/navigationUtils';
import {
  ANNOTATION_SOURCE_TYPES,
  ANNOTATION_TYPES,
  ANNOTATION_TYPES_METADATA,
  DEFAULT_ANNOTATION_TYPE,
  requiresQuery,
  ANNOTATION_SOURCE_TYPES_METADATA,
} from './AnnotationTypes';

interface SelectOption {
  value: string | number;
  label: string;
  viz_type?: string;
  [key: string]: unknown;
}

interface SliceData {
  data: {
    groupby?: string[];
    all_columns?: string[];
    include_time?: boolean;
    [key: string]: unknown;
  };
}

interface AnnotationOverrides {
  time_range?: string | null;
  time_grain_sqla?: string | null;
  granularity?: string | null;
  time_shift?: string;
  [key: string]: unknown;
}

interface AnnotationLayerProps {
  name?: string;
  annotationType?: string;
  sourceType?: string;
  color?: string;
  opacity?: string;
  style?: string;
  width?: number;
  showMarkers?: boolean;
  hideLine?: boolean;
  value?: string | number | SelectOption;
  overrides?: AnnotationOverrides;
  show?: boolean;
  showLabel?: boolean;
  titleColumn?: string;
  descriptionColumns?: string[];
  timeColumn?: string;
  intervalEndColumn?: string;
  vizType?: string;
  error?: string;
  colorScheme?: string;
  canReadAnnotation: boolean;
  addAnnotationLayer?: (annotation: Record<string, unknown>) => void;
  removeAnnotationLayer?: () => void;
  close?: () => void;
}

const AUTOMATIC_COLOR = '';

/** Space between the popover's side-by-side configuration sections, in size units. */
const SECTION_GAP_UNITS = 8;

/** Breathing room kept between the popover and the viewport edge, in size units. */
const VIEWPORT_INSET_UNITS = 2;

const SectionsRow = styled.div<{ $maxWidth: number | string }>`
  display: flex;
  flex-direction: row;
  /* A third section can outgrow a narrow viewport, and an oversized popover
   * cannot be shrunk by antd, only flipped. Bounding the row compresses the
   * sections instead of pushing the footer off screen. */
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.sizeUnit * SECTION_GAP_UNITS}px;
  max-width: ${({ $maxWidth }) =>
    typeof $maxWidth === 'number' ? `${$maxWidth}px` : $maxWidth};
`;

interface ChartApiResult {
  params?: string | null;
  query_context?: string | null;
}

const parseJsonObject = (
  raw: string | null | undefined,
): Record<string, unknown> | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

// `query_context` is only backfilled once a chart is opened in Explore, so fall
// back to `params`, which holds the same form data and is always present.
const getSliceFormData = (
  result: ChartApiResult,
): Record<string, unknown> | null => {
  const formData = parseJsonObject(result.query_context)?.form_data;
  if (formData && typeof formData === 'object') {
    return formData as Record<string, unknown>;
  }
  return parseJsonObject(result.params);
};

const reportChartFailure = (id: string | number) => (error: unknown) =>
  logging.error(`Failed to load annotation source chart ${id}`, error);

const reportAnnotationLayerFailure =
  (id: string | number) => (error: unknown) =>
    logging.error(`Failed to load annotation layer ${id}`, error);

const toSliceData = (formData: Record<string, unknown>): SliceData => ({
  data: {
    ...formData,
    groupby: (formData.groupby as QueryFormColumn[] | undefined)?.map(column =>
      getColumnLabel(column),
    ),
  },
});

const NotFoundContentWrapper = styled.div`
  && > div:first-of-type {
    padding-left: 0;
    padding-right: 0;
  }
`;

const NotFoundContent = () => (
  <NotFoundContentWrapper>
    <EmptyState
      title={t('No annotation layers')}
      size="small"
      description={
        <span>
          {t('Add an annotation layer')}{' '}
          <a
            // encodeURI wraps the DOM-derived application-root prefix so
            // CodeQL's `js/html-injection` sees a recognised through-function
            // sanitiser between `applicationRoot()` (reads `data-bootstrap`
            // from the DOM) and the `<a href>` sink. The string fed in is a
            // URL-normalised path (`/seg/seg`) so encodeURI is idempotent in
            // practice — it does not alter the navigation target.
            href={encodeURI(ensureAppRoot('/annotationlayer/list'))}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('here')}
          </a>
          .
        </span>
      }
      image="empty.svg"
    />
  </NotFoundContentWrapper>
);

function AnnotationLayer({
  name: propName = '',
  annotationType: propAnnotationType = DEFAULT_ANNOTATION_TYPE,
  sourceType: propSourceType = '',
  color: propColor = AUTOMATIC_COLOR,
  opacity: propOpacity = '',
  style: propStyle = 'solid',
  width: propWidth = 1,
  showMarkers: propShowMarkers = false,
  hideLine: propHideLine = false,
  value: propValue,
  overrides: propOverrides = {},
  show: propShow = true,
  showLabel: propShowLabel = false,
  titleColumn: propTitleColumn = '',
  descriptionColumns: propDescriptionColumns = [],
  timeColumn: propTimeColumn = '',
  intervalEndColumn: propIntervalEndColumn = '',
  vizType,
  error,
  colorScheme = 'd3Category10',
  canReadAnnotation,
  addAnnotationLayer = () => {},
  removeAnnotationLayer = () => {},
  close = () => {},
}: AnnotationLayerProps) {
  const theme = useTheme();

  // Process overrides - only allow override whole time_range
  const processedOverrides = useMemo((): AnnotationOverrides => {
    const result: AnnotationOverrides = propOverrides
      ? { ...propOverrides }
      : {};
    if ('since' in result || 'until' in result) {
      result.time_range = null;
      delete result.since;
      delete result.until;
    }
    return result;
  }, [propOverrides]);

  // Check if annotationType is supported by this chart
  const validAnnotationType = useMemo(() => {
    const metadata = vizType ? getChartMetadataRegistry().get(vizType) : null;
    const supportedAnnotationTypes = metadata?.supportedAnnotationTypes || [];
    const resolvedAnnotationType =
      propAnnotationType || DEFAULT_ANNOTATION_TYPE;
    const isValid = supportedAnnotationTypes.includes(resolvedAnnotationType);
    return isValid
      ? resolvedAnnotationType
      : supportedAnnotationTypes[0] || DEFAULT_ANNOTATION_TYPE;
  }, [vizType, propAnnotationType]);

  // State
  const [name, setName] = useState(propName || '');
  const [annotationType, setAnnotationType] = useState(validAnnotationType);
  const [sourceType, setSourceType] = useState<string | null>(
    propSourceType || null,
  );
  const [value, setValue] = useState<string | number | SelectOption | null>(
    propValue || null,
  );
  const [overrides, setOverrides] =
    useState<AnnotationOverrides>(processedOverrides);
  const [show, setShow] = useState(propShow ?? true);
  const [showLabel, setShowLabel] = useState(propShowLabel ?? false);
  const [titleColumn, setTitleColumn] = useState(propTitleColumn || '');
  const [descriptionColumns, setDescriptionColumns] = useState<string[]>(
    propDescriptionColumns || [],
  );
  const [timeColumn, setTimeColumn] = useState(propTimeColumn || '');
  const [intervalEndColumn, setIntervalEndColumn] = useState(
    propIntervalEndColumn || '',
  );
  const [color, setColor] = useState(propColor || AUTOMATIC_COLOR);
  const [opacity, setOpacity] = useState(propOpacity || '');
  const [style, setStyle] = useState(propStyle || 'solid');
  const [width, setWidth] = useState(propWidth ?? 1);
  const [showMarkers, setShowMarkers] = useState(propShowMarkers ?? false);
  const [hideLine, setHideLine] = useState(propHideLine ?? false);
  const [isNew, setIsNew] = useState(!propName);
  const [slice, setSlice] = useState<SliceData | null>(null);
  const sectionsRef = useRef<HTMLDivElement>(null);
  const [sectionsMaxWidth, setSectionsMaxWidth] = useState<number>();

  const getSupportedSourceTypes = useCallback(
    (annoType: string): SelectOption[] => {
      // Get vis types that can be source.
      const sources = getChartMetadataRegistry()
        .entries()
        .filter(({ value: chartMetadata }) =>
          chartMetadata?.canBeAnnotationType(annoType),
        )
        .map(({ key, value: chartMetadata }) => ({
          value: key === VizType.Line ? 'line' : key,
          label: chartMetadata?.name || key,
        }));
      // Prepend native source if applicable. Listing native annotation layers
      // requires can_read on Annotation; without it the option is offered only
      // while it is the layer's current selection, so a saved native layer
      // stays intact instead of being silently invalidated.
      const annotationMeta =
        ANNOTATION_TYPES_METADATA[
          annoType as keyof typeof ANNOTATION_TYPES_METADATA
        ];
      if (
        annotationMeta &&
        'supportNativeSource' in annotationMeta &&
        (canReadAnnotation || sourceType === ANNOTATION_SOURCE_TYPES.NATIVE)
      ) {
        sources.unshift(ANNOTATION_SOURCE_TYPES_METADATA.NATIVE);
      }
      return sources;
    },
    [canReadAnnotation, sourceType],
  );

  const shouldFetchAppliedAnnotation = useCallback(
    (): boolean => !!value && requiresQuery(sourceType ?? undefined),
    [value, sourceType],
  );

  const fetchNativeAnnotations = useCallback(
    async (
      search: string,
      page: number,
      pageSize: number,
    ): Promise<{ data: SelectOption[]; totalCount: number }> => {
      const queryParams = rison.encode({
        filters: [
          {
            col: 'name',
            opr: 'ct',
            value: search,
          },
        ],
        columns: ['id', 'name'],
        page,
        page_size: pageSize,
      });

      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/annotation_layer/?q=${queryParams}`,
      });

      const { result, count } = json;

      const layersArray = result.map((layer: { id: number; name: string }) => ({
        value: layer.id,
        label: layer.name,
      }));

      return {
        data: layersArray,
        totalCount: count,
      };
    },
    [],
  );

  const fetchCharts = useCallback(
    async (
      search: string,
      page: number,
      pageSize: number,
    ): Promise<{ data: SelectOption[]; totalCount: number }> => {
      const queryParams = rison.encode({
        filters: [
          { col: 'slice_name', opr: 'chart_all_text', value: search },
          {
            col: 'id',
            opr: 'chart_owned_created_favored_by_me',
            value: true,
          },
        ],
        columns: ['id', 'slice_name', 'viz_type'],
        order_column: 'slice_name',
        order_direction: 'asc',
        page,
        page_size: pageSize,
      });
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/chart/?q=${queryParams}`,
      });

      const { result, count } = json;
      const registry = getChartMetadataRegistry();

      const chartsArray = result
        .filter(
          (chart: { id: number; slice_name: string; viz_type: string }) => {
            const metadata = registry.get(chart.viz_type);
            return metadata && metadata.canBeAnnotationType(annotationType);
          },
        )
        .map((chart: { id: number; slice_name: string; viz_type: string }) => ({
          value: chart.id,
          label: chart.slice_name,
          viz_type: chart.viz_type,
        }));

      return {
        data: chartsArray,
        totalCount: count,
      };
    },
    [annotationType],
  );

  const fetchOptions = useCallback(
    (
      search: string,
      page: number,
      pageSize: number,
    ): Promise<{ data: SelectOption[]; totalCount: number }> => {
      if (sourceType === ANNOTATION_SOURCE_TYPES.NATIVE) {
        return fetchNativeAnnotations(search, page, pageSize);
      }
      return fetchCharts(search, page, pageSize);
    },
    [sourceType, fetchNativeAnnotations, fetchCharts],
  );

  // Both the mount and the selection path load a chart to fill the slice
  // configuration from, so they share how a loaded chart is applied and how a
  // failure is reported.
  const applySliceFormData = useCallback(
    (id: string | number, result: ChartApiResult): void => {
      const formData = getSliceFormData(result);
      if (formData) {
        setSlice(toSliceData(formData));
        return;
      }
      logging.warn(
        `Annotation source chart ${id} has no usable form data; ` +
          'the slice configuration fields cannot be populated.',
      );
    },
    [],
  );

  const fetchSliceData = useCallback(
    (id: string | number): void => {
      const queryParams = rison.encode({
        columns: ['params', 'query_context'],
      });
      SupersetClient.get({
        endpoint: `/api/v1/chart/${id}?q=${queryParams}`,
      })
        .then(({ json }) => applySliceFormData(id, json.result))
        .catch(reportChartFailure(id));
    },
    [applySliceFormData],
  );

  const fetchAppliedChart = useCallback(
    (id: string | number): void => {
      const registry = getChartMetadataRegistry();
      const queryParams = rison.encode({
        columns: ['slice_name', 'params', 'query_context', 'viz_type'],
      });
      SupersetClient.get({
        endpoint: `/api/v1/chart/${id}?q=${queryParams}`,
      })
        .then(({ json }) => {
          const { result } = json;
          const metadata = registry.get(result.viz_type);
          if (!metadata?.canBeAnnotationType(annotationType)) {
            return;
          }
          setValue({
            value: id,
            label: result.slice_name,
          });
          applySliceFormData(id, result);
        })
        .catch(reportChartFailure(id));
    },
    [annotationType, applySliceFormData],
  );

  const fetchAppliedNativeAnnotation = useCallback(
    (id: string | number): void => {
      SupersetClient.get({
        endpoint: `/api/v1/annotation_layer/${id}`,
      })
        .then(({ json }) => {
          const { result } = json;
          const layer = result;
          setValue({
            value: layer.id,
            label: layer.name,
          });
        })
        .catch(reportAnnotationLayerFailure(id));
    },
    [],
  );

  const fetchAppliedAnnotation = useCallback(
    (id: string | number): void => {
      if (sourceType === ANNOTATION_SOURCE_TYPES.NATIVE) {
        // Without can_read on Annotation the request is known to 403; keep the
        // raw id as the value so the saved layer remains valid and untouched.
        if (canReadAnnotation) {
          fetchAppliedNativeAnnotation(id);
        }
      } else {
        fetchAppliedChart(id);
      }
    },
    [
      sourceType,
      canReadAnnotation,
      fetchAppliedNativeAnnotation,
      fetchAppliedChart,
    ],
  );

  // componentDidMount - fetch applied annotation if needed
  useEffect(() => {
    if (shouldFetchAppliedAnnotation()) {
      /* The value prop is the id of the chart/native. This function will set
      value in state to an object with the id as value.value to be used by
      AsyncSelect */
      if (
        propValue !== null &&
        propValue !== undefined &&
        typeof propValue !== 'object'
      ) {
        fetchAppliedAnnotation(propValue);
      }
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track previous value for componentDidUpdate comparison
  const [prevValue, setPrevValue] = useState<
    string | number | SelectOption | null
  >(value);

  // Fetch slice data when value changes — but skip when slice is already
  // populated, which means the change came from `fetchAppliedChart` (the
  // mount-time hydration path that sets both value and slice in lockstep).
  // The user-selection path (`handleSelectValue`) clears slice to null
  // before setting the new value, so this watcher fires correctly there.
  useEffect(() => {
    if (value !== prevValue) {
      const isChart =
        sourceType !== ANNOTATION_SOURCE_TYPES.NATIVE &&
        requiresQuery(sourceType ?? undefined);
      if (
        isChart &&
        value &&
        typeof value === 'object' &&
        'value' in value &&
        !slice
      ) {
        fetchSliceData(value.value);
      }
      setPrevValue(value);
    }
  }, [value, prevValue, sourceType, fetchSliceData, slice]);

  const isValidFormulaAnnotation = useCallback(
    (
      expression: string | number | SelectOption | null,
      annoType: string,
    ): boolean => {
      if (annoType === ANNOTATION_TYPES.FORMULA) {
        return isValidExpression(expression as string);
      }
      return true;
    },
    [],
  );

  const isValidForm = useCallback((): boolean => {
    const errors = [
      validateNonEmpty(name),
      validateNonEmpty(annotationType),
      validateNonEmpty(value),
    ];
    if (sourceType !== ANNOTATION_SOURCE_TYPES.NATIVE) {
      if (annotationType === ANNOTATION_TYPES.EVENT) {
        errors.push(validateNonEmpty(timeColumn));
      }
      if (annotationType === ANNOTATION_TYPES.INTERVAL) {
        errors.push(validateNonEmpty(timeColumn));
        errors.push(validateNonEmpty(intervalEndColumn));
      }
    }
    if (!isValidFormulaAnnotation(value, annotationType)) {
      errors.push(t('Invalid formula expression'));
    }
    return !errors.filter(x => x).length;
  }, [
    name,
    annotationType,
    sourceType,
    value,
    timeColumn,
    intervalEndColumn,
    isValidFormulaAnnotation,
  ]);

  const handleAnnotationType = useCallback((annoType: string): void => {
    setAnnotationType(annoType);
    setSourceType(null);
    setValue(null);
    setSlice(null);
  }, []);

  const handleAnnotationSourceType = useCallback(
    (newSourceType: string): void => {
      if (sourceType !== newSourceType) {
        setSourceType(newSourceType);
        setValue(null);
        setSlice(null);
      }
    },
    [sourceType],
  );

  const handleSelectValue = useCallback(
    (selectedValueObject: SelectOption): void => {
      setValue(selectedValueObject);
      // Clear slice so the value-change watcher refetches for the new chart;
      // see the watcher block above for why this gate exists.
      setSlice(null);
      setDescriptionColumns([]);
      setIntervalEndColumn('');
      setTimeColumn('');
      setTitleColumn('');
      setOverrides({ time_range: null });
    },
    [],
  );

  const handleTextValue = useCallback((inputValue: string): void => {
    setValue(inputValue);
  }, []);

  const deleteAnnotation = useCallback((): void => {
    removeAnnotationLayer?.();
    close?.();
  }, [removeAnnotationLayer, close]);

  const applyAnnotation = useCallback((): void => {
    if (isValidForm()) {
      const stateValues = {
        name,
        annotationType,
        sourceType,
        color,
        opacity,
        style,
        width,
        showMarkers,
        hideLine,
        overrides,
        show,
        showLabel,
        titleColumn,
        descriptionColumns,
        timeColumn,
        intervalEndColumn,
      };

      const newAnnotation: Record<string, unknown> = {};
      Object.entries(stateValues).forEach(([field, fieldValue]) => {
        if (fieldValue !== null) {
          newAnnotation[field] = fieldValue;
        }
      });

      // Prepare newAnnotation.value for use in runAnnotationQuery()
      const applicableValue =
        requiresQuery(sourceType ?? undefined) &&
        value &&
        typeof value === 'object'
          ? (value as SelectOption).value
          : value;
      newAnnotation.value = applicableValue;

      if (newAnnotation.color === AUTOMATIC_COLOR) {
        newAnnotation.color = null;
      }

      addAnnotationLayer?.(newAnnotation);
      setIsNew(false);
    }
  }, [
    isValidForm,
    name,
    annotationType,
    sourceType,
    color,
    opacity,
    style,
    width,
    showMarkers,
    hideLine,
    overrides,
    show,
    showLabel,
    titleColumn,
    descriptionColumns,
    timeColumn,
    intervalEndColumn,
    value,
    addAnnotationLayer,
  ]);

  const submitAnnotation = useCallback((): void => {
    applyAnnotation();
    close?.();
  }, [applyAnnotation, close]);

  // Inlined: this is a pure helper that produces JSX from its args. The
  // previous useCallback wrapper added no value — `renderChartHeader(label,
  // description, value)` was called inline, so the produced ReactNode was
  // recreated each call anyway, and no downstream consumer depended on the
  // function's identity.
  const buildChartHeader = (
    label: string,
    description: string,
    val: string | number | SelectOption | null,
  ): React.ReactNode => (
    <ControlHeader
      hovered
      label={label}
      description={description}
      validationErrors={!val ? ['Mandatory'] : []}
    />
  );

  const renderValueConfiguration = useCallback((): React.ReactNode => {
    let label = '';
    let description = '';
    if (requiresQuery(sourceType ?? undefined)) {
      if (sourceType === ANNOTATION_SOURCE_TYPES.NATIVE) {
        label = t('Annotation layer');
        description = t('Select the Annotation Layer you would like to use.');
      } else {
        label = t('Chart');
        description = t(
          `Use another existing chart as a source for annotations and overlays.
          Your chart must be one of these visualization types: [%s]`,
          getSupportedSourceTypes(annotationType)
            .map(x => x.label)
            .join(', '),
        );
      }
    } else if (annotationType === ANNOTATION_TYPES.FORMULA) {
      label = t('Formula');
      description = t(`Expects a formula with depending time parameter 'x'
        in milliseconds since epoch. mathjs is used to evaluate the formulas.
        Example: '2x+5'`);
    }
    if (requiresQuery(sourceType ?? undefined)) {
      // Listing native annotation layers requires can_read on Annotation.
      // Keep the select visible but inert so the saved reference can still be
      // removed, restyled, or switched to a permitted source; the select stays
      // lazy, so no forbidden request is ever fired.
      const isBlockedNativeSource =
        sourceType === ANNOTATION_SOURCE_TYPES.NATIVE && !canReadAnnotation;
      return (
        <>
          <AsyncSelect
            /* key to force re-render on sourceType change */
            key={sourceType}
            ariaLabel={t('Annotation layer value')}
            name="annotation-layer-value"
            header={buildChartHeader(label, description, value)}
            options={fetchOptions}
            value={value || null}
            onChange={handleSelectValue}
            notFoundContent={<NotFoundContent />}
            disabled={isBlockedNativeSource}
          />
          {isBlockedNativeSource && (
            <div>
              <Typography.Text type="secondary">
                {t("You don't have permission to view annotation layers.")}
              </Typography.Text>
            </div>
          )}
        </>
      );
    }
    if (annotationType === ANNOTATION_TYPES.FORMULA) {
      // Extract primitive value for TextControl (formula is always a string)
      const textValue = typeof value === 'object' ? null : value;
      return (
        <TextControl
          name="annotation-layer-value"
          hovered
          showHeader
          description={description}
          label={label}
          placeholder=""
          value={textValue}
          onChange={handleTextValue}
          validationErrors={
            !isValidFormulaAnnotation(value, annotationType)
              ? [t('Bad formula.')]
              : []
          }
        />
      );
    }
    return '';
  }, [
    sourceType,
    annotationType,
    value,
    canReadAnnotation,
    getSupportedSourceTypes,
    fetchOptions,
    handleSelectValue,
    handleTextValue,
    isValidFormulaAnnotation,
  ]);

  const renderSliceConfiguration = useCallback((): React.ReactNode => {
    if (!slice || !value) {
      return '';
    }

    if (sourceType !== ANNOTATION_SOURCE_TYPES.NATIVE && slice) {
      const columns = (slice.data.groupby || [])
        .concat(slice.data.all_columns || [])
        .map(x => ({ value: x, label: x }));
      const timeColumnOptions = slice.data.include_time
        ? [{ value: '__timestamp', label: '__timestamp' }].concat(columns)
        : columns;
      return (
        <div>
          <PopoverSection
            isSelected
            title={t('Annotation Slice Configuration')}
            info={t(`This section allows you to configure how to use the slice
              to generate annotations.`)}
          >
            {(annotationType === ANNOTATION_TYPES.EVENT ||
              annotationType === ANNOTATION_TYPES.INTERVAL) && (
              <SelectControl
                ariaLabel={t('Annotation layer time column')}
                hovered
                name="annotation-layer-time-column"
                label={
                  annotationType === ANNOTATION_TYPES.INTERVAL
                    ? t('Interval start column')
                    : t('Event time column')
                }
                description={t(
                  'This column must contain date/time information.',
                )}
                validationErrors={!timeColumn ? ['Mandatory'] : []}
                clearable={false}
                options={timeColumnOptions}
                value={timeColumn}
                onChange={(
                  v: string | number | (string | number)[] | null | undefined,
                ) => setTimeColumn(String(v ?? ''))}
              />
            )}
            {annotationType === ANNOTATION_TYPES.INTERVAL && (
              <SelectControl
                ariaLabel={t('Annotation layer interval end')}
                hovered
                name="annotation-layer-intervalEnd"
                label={t('Interval End column')}
                description={t(
                  'This column must contain date/time information.',
                )}
                validationErrors={!intervalEndColumn ? ['Mandatory'] : []}
                options={columns}
                value={intervalEndColumn}
                onChange={(
                  v: string | number | (string | number)[] | null | undefined,
                ) => setIntervalEndColumn(String(v ?? ''))}
              />
            )}
            <SelectControl
              ariaLabel={t('Annotation layer title column')}
              hovered
              name="annotation-layer-title"
              label={t('Title Column')}
              description={t('Pick a title for you annotation.')}
              options={[{ value: '', label: t('None') }].concat(columns)}
              value={titleColumn}
              onChange={(
                v: string | number | (string | number)[] | null | undefined,
              ) => setTitleColumn(String(v ?? ''))}
            />
            {annotationType !== ANNOTATION_TYPES.TIME_SERIES && (
              <SelectControl
                ariaLabel={t('Annotation layer description columns')}
                hovered
                name="annotation-layer-title"
                label={t('Description Columns')}
                description={t(
                  "Pick one or more columns that should be shown in the annotation. If you don't select a column all of them will be shown.",
                )}
                multi
                options={columns}
                value={descriptionColumns}
                onChange={(
                  v: string | number | (string | number)[] | null | undefined,
                ) => {
                  const cols = Array.isArray(v) ? v.map(String) : [];
                  setDescriptionColumns(cols);
                }}
              />
            )}
            <div style={{ marginTop: '1rem' }}>
              <CheckboxControl
                hovered
                name="annotation-override-time_range"
                label={t('Override time range')}
                description={t(`This controls whether the "time_range" field from the current
                  view should be passed down to the chart containing the annotation data.`)}
                value={'time_range' in overrides}
                onChange={v => {
                  const newOverrides = { ...overrides };
                  delete newOverrides.time_range;
                  if (v) {
                    setOverrides({ ...newOverrides, time_range: null });
                  } else {
                    setOverrides({ ...newOverrides });
                  }
                }}
              />
              <CheckboxControl
                hovered
                name="annotation-override-timegrain"
                label={t('Override time grain')}
                description={t(`This controls whether the time grain field from the current
                  view should be passed down to the chart containing the annotation data.`)}
                value={'time_grain_sqla' in overrides}
                onChange={v => {
                  const newOverrides = { ...overrides };
                  delete newOverrides.time_grain_sqla;
                  delete newOverrides.granularity;
                  if (v) {
                    setOverrides({
                      ...newOverrides,
                      time_grain_sqla: null,
                      granularity: null,
                    });
                  } else {
                    setOverrides({ ...newOverrides });
                  }
                }}
              />
              <TextControl
                hovered
                name="annotation-layer-timeshift"
                label={t('Time Shift')}
                description={t(`Time delta in natural language
                  (example:  24 hours, 7 days, 56 weeks, 365 days)`)}
                placeholder=""
                value={overrides.time_shift}
                onChange={v => setOverrides({ ...overrides, time_shift: v })}
              />
            </div>
          </PopoverSection>
        </div>
      );
    }
    return '';
  }, [
    slice,
    value,
    sourceType,
    annotationType,
    timeColumn,
    intervalEndColumn,
    titleColumn,
    descriptionColumns,
    overrides,
  ]);

  const renderDisplayConfiguration = useCallback((): React.ReactNode => {
    const schemeColors =
      getCategoricalSchemeRegistry().get(colorScheme)?.colors.concat() ?? [];
    if (
      color &&
      color !== AUTOMATIC_COLOR &&
      !schemeColors.some(x => x.toLowerCase() === color.toLowerCase())
    ) {
      schemeColors.push(color);
    }
    return (
      <PopoverSection
        isSelected
        title={t('Display configuration')}
        info={t('Configure your how you overlay is displayed here.')}
      >
        <SelectControl
          ariaLabel={t('Annotation layer stroke')}
          name="annotation-layer-stroke"
          label={t('Style')}
          options={[
            { value: 'solid', label: t('Solid') },
            { value: 'dashed', label: t('Dashed') },
            { value: 'longDashed', label: t('Long dashed') },
            { value: 'dotted', label: t('Dotted') },
          ]}
          value={style}
          clearable={false}
          onChange={(
            v: string | number | (string | number)[] | null | undefined,
          ) => setStyle(String(v ?? 'solid'))}
        />
        <SelectControl
          ariaLabel={t('Annotation layer opacity')}
          name="annotation-layer-opacity"
          label={t('Opacity')}
          options={[
            { value: '', label: t('Solid') },
            { value: 'opacityLow', label: '0.2' },
            { value: 'opacityMedium', label: '0.5' },
            { value: 'opacityHigh', label: '0.8' },
          ]}
          value={opacity}
          onChange={(
            v: string | number | (string | number)[] | null | undefined,
          ) => setOpacity(String(v ?? ''))}
        />
        <div
          style={{
            marginTop: theme.sizeUnit * 2,
            marginBottom: theme.sizeUnit * 2,
          }}
        >
          <CheckboxControl
            name="annotation-layer-automatic-color"
            label={t('Use automatic color')}
            value={color === AUTOMATIC_COLOR}
            onChange={useAutomatic => {
              if (useAutomatic) {
                setColor(AUTOMATIC_COLOR);
              } else {
                // Set to first theme color or dark color as fallback
                setColor(schemeColors[0] || theme.colorTextBase);
              }
            }}
          />
          {color !== AUTOMATIC_COLOR && (
            <div style={{ marginTop: theme.sizeUnit * 2 }}>
              <ControlHeader label={t('Color')} />
              <ColorPicker
                value={color}
                presets={[{ label: 'Theme colors', colors: schemeColors }]}
                onChangeComplete={colorValue =>
                  setColor(colorValue.toHexString())
                }
                showText
              />
            </div>
          )}
        </div>
        <TextControl
          name="annotation-layer-stroke-width"
          label={t('Line width')}
          isInt
          value={width}
          onChange={v => setWidth(v)}
        />
        {annotationType === ANNOTATION_TYPES.TIME_SERIES && (
          <CheckboxControl
            hovered
            name="annotation-layer-show-markers"
            label={t('Show Markers')}
            description={t('Shows or hides markers for the time series')}
            value={showMarkers}
            onChange={v => setShowMarkers(v)}
          />
        )}
        {annotationType === ANNOTATION_TYPES.TIME_SERIES && (
          <CheckboxControl
            hovered
            name="annotation-layer-hide-line"
            label={t('Hide Line')}
            description={t('Hides the Line for the time series')}
            value={hideLine}
            onChange={v => setHideLine(v)}
          />
        )}
      </PopoverSection>
    );
  }, [
    colorScheme,
    color,
    opacity,
    style,
    width,
    showMarkers,
    hideLine,
    annotationType,
    theme,
  ]);

  const sliceConfiguration = renderSliceConfiguration();
  const hasSliceConfiguration = !!sliceConfiguration;

  const sectionGap = theme.sizeUnit * SECTION_GAP_UNITS;
  const viewportInset = theme.sizeUnit * VIEWPORT_INSET_UNITS;

  const measureSectionsMaxWidth = useCallback(() => {
    const row = sectionsRef.current;
    const popover = row?.closest('.ant-popover');
    const panel = document.getElementById(CONTROL_SECTIONS_ID);
    // The cap is measured against Explore's control panel. Rendered anywhere
    // else - or not inside a popover - there is nothing to measure from, so the
    // row keeps the viewport-wide fallback below rather than being capped.
    if (!row || !popover || !panel) {
      return;
    }
    // Padding and border the popover adds around the row.
    const popoverInsetWidth =
      popover.getBoundingClientRect().width - row.getBoundingClientRect().width;
    const viewport = document.documentElement.clientWidth;
    const sections = Array.from(row.children);
    // Room the sections need to stay on one line. Wrapping them makes the popover
    // roughly twice as tall, which no shift can pull back inside a short viewport.
    const oneLine =
      sections.reduce(
        (total, section) => total + section.getBoundingClientRect().width,
        0,
      ) +
      sectionGap * Math.max(sections.length - 1, 0);
    // Fitting beside the panel needs no shift, avoiding the offset antd leaves
    // behind when it shifts. Wrapping to get there costs more than the offset, so
    // anything narrower falls back to the viewport and antd shifts across the panel.
    const besidePanel =
      viewport -
      panel.getBoundingClientRect().right -
      popoverInsetWidth -
      viewportInset;
    const available =
      besidePanel >= oneLine
        ? besidePanel
        : viewport - popoverInsetWidth - viewportInset * 2;
    if (available > 0) {
      setSectionsMaxWidth(available);
    }
  }, [sectionGap, viewportInset]);

  // Resizing the viewport or dragging the panel moves the edge the cap derives
  // from, so remeasure while the popover is open. Observing the panel and not the
  // popover keeps it stable: the cap changes the popover's width, never the panel's.
  useLayoutEffect(() => {
    measureSectionsMaxWidth();
    const panel = document.getElementById(CONTROL_SECTIONS_ID);
    const observer = new ResizeObserver(measureSectionsMaxWidth);
    if (panel) {
      observer.observe(panel);
    }
    window.addEventListener('resize', measureSectionsMaxWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measureSectionsMaxWidth);
    };
  }, [hasSliceConfiguration, measureSectionsMaxWidth]);

  const isValid = isValidForm();
  const metadata = vizType ? getChartMetadataRegistry().get(vizType) : null;
  const supportedAnnotationTypes = metadata
    ? metadata.supportedAnnotationTypes.map(
        type =>
          ANNOTATION_TYPES_METADATA[
            type as keyof typeof ANNOTATION_TYPES_METADATA
          ],
      )
    : [];
  const supportedSourceTypes = getSupportedSourceTypes(annotationType);

  return (
    <>
      {error && (
        <span style={{ color: theme.colorError }}>
          {t('ERROR')}: {error}
        </span>
      )}
      <SectionsRow
        ref={sectionsRef}
        data-test="annotation-layer-sections"
        $maxWidth={sectionsMaxWidth ?? `calc(100vw - ${sectionGap * 2}px)`}
      >
        <div>
          <PopoverSection
            isSelected
            title={t('Layer configuration')}
            info={t('Configure the basics of your Annotation Layer.')}
          >
            <TextControl
              name="annotation-layer-name"
              label={t('Name')}
              placeholder=""
              value={name}
              onChange={v => setName(v)}
              validationErrors={!name ? [t('Mandatory')] : []}
            />
            <CheckboxControl
              name="annotation-layer-hide"
              label={t('Hide layer')}
              value={!show}
              onChange={v => setShow(!v)}
            />
            <CheckboxControl
              name="annotation-label-show"
              label={t('Show label')}
              value={showLabel}
              hovered
              description={t('Whether to always show the annotation label')}
              onChange={v => setShowLabel(v)}
            />
            <SelectControl
              ariaLabel={t('Annotation layer type')}
              hovered
              description={t('Choose the annotation layer type')}
              label={t('Annotation layer type')}
              name="annotation-layer-type"
              clearable={false}
              options={supportedAnnotationTypes}
              value={annotationType}
              onChange={handleAnnotationType}
            />
            {supportedSourceTypes.length > 0 && (
              <SelectControl
                ariaLabel={t('Annotation source type')}
                hovered
                description={t('Choose the source of your annotations')}
                label={t('Annotation source')}
                name="annotation-source-type"
                options={supportedSourceTypes}
                notFoundContent={<NotFoundContent />}
                value={sourceType}
                onChange={handleAnnotationSourceType}
                validationErrors={!sourceType ? [t('Mandatory')] : []}
              />
            )}
            {renderValueConfiguration()}
          </PopoverSection>
        </div>
        {sliceConfiguration}
        {renderDisplayConfiguration()}
      </SectionsRow>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {isNew ? (
          <Button
            buttonSize="small"
            buttonStyle="secondary"
            onClick={() => close?.()}
          >
            {t('Cancel')}
          </Button>
        ) : (
          <Button
            buttonSize="small"
            buttonStyle="secondary"
            onClick={deleteAnnotation}
          >
            {t('Remove')}
          </Button>
        )}
        <div>
          <Button
            buttonSize="small"
            disabled={!isValid}
            onClick={applyAnnotation}
          >
            {t('Apply')}
          </Button>

          <Button
            buttonSize="small"
            buttonStyle="primary"
            disabled={!isValid}
            onClick={submitAnnotation}
          >
            {t('OK')}
          </Button>
        </div>
      </div>
    </>
  );
}

export default AnnotationLayer;
