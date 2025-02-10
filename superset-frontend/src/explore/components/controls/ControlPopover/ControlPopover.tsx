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
} from 'src/components/Popover';

import { TooltipPlacement } from 'src/components/Tooltip';

const sectionContainerId = 'controlSections';
export const getSectionContainerElement = () =>
  document.getElementById(sectionContainerId)?.lastElementChild as HTMLElement;

const getElementVisibilityRatio = (node?: HTMLElement) => {
  const containerHeight = window?.innerHeight;
  const containerWidth = window?.innerWidth;

  const rect = node?.getBoundingClientRect();
  if (!containerHeight || !containerWidth || !rect?.top) {
    return { yRatio: 0, xRatio: 0 };
  }

  const yRatio = rect.top / containerHeight;
  const xRatio = rect.left / containerWidth;
  return { yRatio, xRatio };
};

export type PopoverProps = BasePopoverProps & {
  getVisibilityRatio?: typeof getElementVisibilityRatio;
};

const ControlPopover: FC<PopoverProps> = ({
  getPopupContainer,
  getVisibilityRatio = getElementVisibilityRatio,
  open: visibleProp,
  destroyTooltipOnHide = false,
  placement: initialPlacement = 'right',
  ...props
}) => {
  const triggerElementRef = useRef<HTMLElement>();

  const [visible, setVisible] = useState(
    visibleProp === undefined ? props.defaultOpen : visibleProp,
  );
  const [placement, setPlacement] =
    React.useState<TooltipPlacement>(initialPlacement);

  const calculatePlacement = useCallback(() => {
    if (!triggerElementRef.current) return;

    const { yRatio, xRatio } = getVisibilityRatio(triggerElementRef.current);

    const horizontalPlacement =
      xRatio < 0.35 ? 'right' : xRatio > 0.65 ? 'left' : '';

    const verticalPlacement = (() => {
      if (yRatio < 0.35) return horizontalPlacement ? 'top' : 'bottom';
      if (yRatio > 0.65) return horizontalPlacement ? 'bottom' : 'top';
      return '';
    })();

    const newPlacement =
      ((horizontalPlacement
        ? horizontalPlacement +
          verticalPlacement.charAt(0).toUpperCase() +
          verticalPlacement.slice(1)
        : verticalPlacement) as TooltipPlacement) || 'left';
    if (newPlacement !== placement) {
      setPlacement(newPlacement);
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
      props.onOpenChange?.(!!visible);
    },
    [props, changeContainerScrollStatus],
  );

  const handleDocumentKeyDownListener = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setVisible(false);
        props.onOpenChange?.(false);
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
      open={visible}
      arrow={{ pointAtCenter: true }}
      placement={placement}
      onOpenChange={handleOnVisibleChange}
      getPopupContainer={handleGetPopupContainer}
      destroyTooltipOnHide={destroyTooltipOnHide}
    />
  );
};

export default ControlPopover;
