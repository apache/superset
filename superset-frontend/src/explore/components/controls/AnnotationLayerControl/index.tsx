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
import { connect } from 'react-redux';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '@apache-superset/core';
import {
  HandlerFunction,
  JsonObject,
  Payload,
  QueryFormData,
} from '@superset-ui/core';
import { SupersetTheme, useTheme } from '@apache-superset/core/ui';
import {
  AsyncEsmComponent,
  List,
  InfoTooltip,
} from '@superset-ui/core/components';
import { getChartKey } from 'src/explore/exploreUtils';
import { runAnnotationQuery } from 'src/components/Chart/chartAction';
import CustomListItem from 'src/explore/components/controls/CustomListItem';
import { ChartState, ExplorePageState } from 'src/explore/types';
import { AnyAction } from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { Icons } from '@superset-ui/core/components/Icons';
import ControlPopover, {
  getSectionContainerElement,
} from '../ControlPopover/ControlPopover';

const AnnotationLayer = AsyncEsmComponent(
  () => import('./AnnotationLayer'),
  // size of overlay inner content
  () => <div style={{ width: 450, height: 368 }} />,
);

export interface Annotation {
  name: string;
  show?: boolean;
  annotation: string;
  timeout: Date;
  key: string;
  formData: QueryFormData | null;
  isDashboardRequest?: boolean;
  force?: boolean;
}

export interface Props {
  colorScheme: string;
  annotationError: Record<string, string>;
  annotationQuery: Record<string, AbortController>;
  vizType: string;
  validationErrors: JsonObject[];
  name: string;
  actions: {
    setControlValue: HandlerFunction;
  };
  value: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  refreshAnnotationData: (payload: Payload) => void;
  theme?: SupersetTheme;
}

export interface PopoverState {
  popoverVisible: Record<number | string, boolean>;
  addedAnnotationIndex: number | null;
}

function AnnotationLayerControl({
  colorScheme,
  annotationError = {},
  annotationQuery = {},
  vizType = '',
  validationErrors,
  name,
  actions,
  value = [],
  onChange = () => {},
  refreshAnnotationData,
}: Props) {
  const theme = useTheme();
  const [popoverVisible, setPopoverVisible] = useState<
    Record<number | string, boolean>
  >({});
  const [addedAnnotationIndex, setAddedAnnotationIndex] = useState<
    number | null
  >(null);

  // componentDidMount - preload the AnnotationLayer component and dependent libraries i.e. mathjs
  useEffect(() => {
    AnnotationLayer.preload();
  }, []);

  // componentDidUpdate - sync validation errors
  useEffect(() => {
    if (
      (Object.keys(annotationError).length && !validationErrors.length) ||
      (!Object.keys(annotationError).length && validationErrors.length)
    ) {
      actions.setControlValue(name, value, Object.keys(annotationError));
    }
  }, [annotationError, validationErrors, value, actions, name]);

  const addAnnotationLayer = useCallback(
    (originalAnnotation: Annotation | null, newAnnotation: Annotation) => {
      let annotations = value;
      if (originalAnnotation && annotations.includes(originalAnnotation)) {
        annotations = annotations.map(anno =>
          anno === originalAnnotation ? newAnnotation : anno,
        );
      } else {
        annotations = [...annotations, newAnnotation];
        setAddedAnnotationIndex(annotations.length - 1);
      }

      refreshAnnotationData({
        annotation: newAnnotation,
        force: true,
      });

      onChange(annotations);
    },
    [value, refreshAnnotationData, onChange],
  );

  const handleVisibleChange = useCallback(
    (visible: boolean, popoverKey: number | string) => {
      setPopoverVisible(prev => ({
        ...prev,
        [popoverKey]: visible,
      }));
    },
    [],
  );

  const removeAnnotationLayer = useCallback(
    (annotation: Annotation | null) => {
      const annotations = value.filter(anno => anno !== annotation);
      // So scrollbar doesnt get stuck on hidden
      const element = getSectionContainerElement();
      if (element) {
        element.style.setProperty('overflow-y', 'auto', 'important');
      }
      onChange(annotations);
    },
    [value, onChange],
  );

  const renderPopover = useCallback(
    (
      popoverKey: number | string,
      annotation: Annotation | null,
      error: string,
    ) => {
      const id = annotation?.name || '_new';

      return (
        <div id={`annotation-pop-${id}`} data-test="popover-content">
          <AnnotationLayer
            {...(annotation || {})}
            error={error}
            colorScheme={colorScheme}
            vizType={vizType}
            addAnnotationLayer={(newAnnotation: Annotation) =>
              addAnnotationLayer(annotation, newAnnotation)
            }
            removeAnnotationLayer={() => removeAnnotationLayer(annotation)}
            close={() => {
              handleVisibleChange(false, popoverKey);
              setAddedAnnotationIndex(null);
            }}
          />
        </div>
      );
    },
    [
      colorScheme,
      vizType,
      addAnnotationLayer,
      removeAnnotationLayer,
      handleVisibleChange,
    ],
  );

  const renderInfo = useCallback(
    (anno: Annotation) => {
      if (annotationQuery[anno.name]) {
        return (
          <Icons.SyncOutlined iconColor={theme.colorPrimary} iconSize="m" />
        );
      }
      if (annotationError[anno.name]) {
        return (
          <InfoTooltip
            label="validation-errors"
            type="error"
            tooltip={annotationError[anno.name]}
          />
        );
      }
      if (!anno.show) {
        return <span style={{ color: theme.colorError }}> {t('Hidden')} </span>;
      }
      return '';
    },
    [annotationQuery, annotationError, theme],
  );

  const addedAnnotation = useMemo(
    () => (addedAnnotationIndex !== null ? value[addedAnnotationIndex] : null),
    [addedAnnotationIndex, value],
  );

  const annotations = value.map((anno, i) => (
    <ControlPopover
      key={i}
      trigger="click"
      title={t('Edit annotation layer')}
      css={thm => ({
        '&:hover': {
          cursor: 'pointer',
          backgroundColor: thm.colorFillContentHover,
        },
      })}
      content={renderPopover(i, anno, annotationError[anno.name])}
      open={popoverVisible[i]}
      onOpenChange={visible => handleVisibleChange(visible, i)}
    >
      <CustomListItem selectable>
        <span>{anno.name}</span>
        <span style={{ float: 'right' }}>{renderInfo(anno)}</span>
      </CustomListItem>
    </ControlPopover>
  ));

  const addLayerPopoverKey = 'add';

  return (
    <div>
      <List bordered css={thm => ({ borderRadius: thm.borderRadius })}>
        {annotations}
        <ControlPopover
          trigger="click"
          content={renderPopover(addLayerPopoverKey, addedAnnotation, '')}
          title={t('Add annotation layer')}
          open={popoverVisible[addLayerPopoverKey]}
          destroyTooltipOnHide
          onOpenChange={visible =>
            handleVisibleChange(visible, addLayerPopoverKey)
          }
        >
          <CustomListItem selectable>
            <Icons.PlusOutlined
              iconSize="m"
              data-test="add-annotation-layer-button"
            />
            {t('Add annotation layer')}
          </CustomListItem>
        </ControlPopover>
      </List>
    </div>
  );
}

// Tried to hook this up through stores/control.jsx instead of using redux
// directly, could not figure out how to get access to the color_scheme
function mapStateToProps({
  charts,
  explore,
}: Pick<ExplorePageState, 'charts' | 'explore'>) {
  const chartKey = getChartKey(explore);

  const defaultChartState: Partial<ChartState> = {
    annotationError: {},
    annotationQuery: {},
  };

  const chart =
    chartKey && charts[chartKey] ? charts[chartKey] : defaultChartState;

  return {
    // eslint-disable-next-line camelcase
    colorScheme: explore.controls?.color_scheme?.value,
    annotationError: chart.annotationError ?? {},
    annotationQuery: chart.annotationQuery ?? {},
    vizType: explore.controls?.viz_type.value,
  };
}

function mapDispatchToProps(
  dispatch: ThunkDispatch<any, undefined, AnyAction>,
) {
  return {
    // Note: There's a type mismatch between the local Annotation interface
    // and RunAnnotationQueryParams. This cast preserves existing runtime behavior.
    refreshAnnotationData: (annotation: Annotation) =>
      dispatch(
        runAnnotationQuery(
          annotation as unknown as Parameters<typeof runAnnotationQuery>[0],
        ),
      ),
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(AnnotationLayerControl);
