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
// eslint-disable-next-line no-restricted-syntax -- whole React import is required for `ControlPopover.test.tsx` Jest test passing.
import React, { FC, useCallback, useRef, useEffect, useState } from 'react';

import Popover, {
  PopoverProps as BasePopoverProps,
  TooltipPlacement,
} from 'src/components/Popover';

const sectionContainerId = 'controlSections';
export const getSectionContainerElement = () =>
  document.getElementById(sectionContainerId)?.lastElementChild as HTMLElement;

const getElementYVisibilityRatioOnContainer = (node: HTMLElement) => {
  const containerHeight = window?.innerHeight;
  const nodePositionInViewport = node?.getBoundingClientRect()?.top;
  if (!containerHeight || !nodePositionInViewport) {
    return 0;
  }

  return nodePositionInViewport / containerHeight;
};

export type PopoverProps = BasePopoverProps & {
  getVisibilityRatio?: typeof getElementYVisibilityRatioOnContainer;
};

const ControlPopover: FC<PopoverProps> = ({
  getPopupContainer,
  getVisibilityRatio = getElementYVisibilityRatioOnContainer,
  visible: visibleProp,
  destroyTooltipOnHide = false,
  ...props
}) => {
  const triggerElementRef = useRef<HTMLElement>();

  const [visible, setVisible] = useState(
    visibleProp === undefined ? props.defaultVisible : visibleProp,
  );
  const [placement, setPlacement] = React.useState<TooltipPlacement>('right');

  const calculatePlacement = useCallback(() => {
    const visibilityRatio = getVisibilityRatio(triggerElementRef.current!);
    if (visibilityRatio < 0.35 && placement !== 'rightTop') {
      setPlacement('rightTop');
    } else if (visibilityRatio > 0.65 && placement !== 'rightBottom') {
      setPlacement('rightBottom');
    } else {
      setPlacement('right');
    }
  }, [getVisibilityRatio]);

  const changeContainerScrollStatus = useCallback(
    visible => {
      const element = getSectionContainerElement();
      if (element) {
        element.style.setProperty(
          'overflow-y',
          visible ? 'hidden' : 'auto',
          'important',
        );
      }
    },
    [calculatePlacement],
  );

  const handleGetPopupContainer = useCallback(
    (triggerNode: HTMLElement) => {
      triggerElementRef.current = triggerNode;

      return getPopupContainer?.(triggerNode) || document.body;
    },
    [calculatePlacement, getPopupContainer],
  );

  const handleOnVisibleChange = useCallback(
    (visible: boolean | undefined) => {
      if (visible === undefined) {
        changeContainerScrollStatus(visible);
      }

      setVisible(!!visible);
      props.onVisibleChange?.(!!visible);
    },
    [props, changeContainerScrollStatus],
  );

  const handleDocumentKeyDownListener = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setVisible(false);
        props.onVisibleChange?.(false);
      }
    },
    [props],
  );

  useEffect(() => {
    if (visibleProp !== undefined) {
      setVisible(!!visibleProp);
    }
  }, [visibleProp]);

  useEffect(() => {
    if (visible !== undefined) {
      changeContainerScrollStatus(visible);
    }
  }, [visible, changeContainerScrollStatus]);

  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleDocumentKeyDownListener);
    }

    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDownListener);
    };
  }, [handleDocumentKeyDownListener, visible]);

  useEffect(() => {
    if (visible) {
      calculatePlacement();
    }
  }, [visible, calculatePlacement]);

  return (
    <Popover
      {...props}
      visible={visible}
      arrowPointAtCenter
      placement={placement}
      onVisibleChange={handleOnVisibleChange}
      getPopupContainer={handleGetPopupContainer}
      destroyTooltipOnHide={destroyTooltipOnHide}
    />
  );
};

export default ControlPopover;
