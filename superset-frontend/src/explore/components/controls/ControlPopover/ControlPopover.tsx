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

import {
  Popover,
  PopoverProps as BasePopoverProps,
} from '@superset-ui/core/components';

import { TooltipPlacement } from '@superset-ui/core/components/Tooltip/types';

import { CONTROL_SECTIONS_ID } from 'src/explore/constants';

export const getSectionContainerElement = () =>
  document.getElementById(CONTROL_SECTIONS_ID)?.lastElementChild as HTMLElement;

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

/** Placements antd already shifts, capped so the arrow keeps touching its trigger. */
const SHIFTING_PLACEMENTS = new Set(['top', 'bottom', 'left', 'right']);

/**
 * antd forwards `autoAdjustOverflow` to rc-trigger, which also reads `shiftX` and
 * `shiftY` from it, but leaves those two out of the type it accepts. Declaring
 * them keeps `adjustX`/`adjustY` checked against antd's own definition.
 * @see https://github.com/react-component/trigger/blob/master/src/hooks/useAlign.ts
 */
type ShiftableOverflow = Exclude<
  BasePopoverProps['autoAdjustOverflow'],
  boolean | undefined
> & {
  shiftX?: boolean | number;
  shiftY?: boolean | number;
};

export const SHIFT_INTO_VIEWPORT: ShiftableOverflow = {
  adjustX: 1,
  adjustY: 1,
  shiftX: true,
  shiftY: true,
};

// The other placements can flip a popup across its trigger but never nudge it back
// into the viewport, leaving an oversized one stranded off screen. Only they opt in:
// lifting the cap above would let those popups slide off a trigger scrolled out of
// view, taking the arrow away from what it points at.
export const getAutoAdjustOverflow = (placement: TooltipPlacement) =>
  SHIFTING_PLACEMENTS.has(placement) ? true : SHIFT_INTO_VIEWPORT;

const ControlPopover: FC<PopoverProps> = ({
  getPopupContainer,
  getVisibilityRatio = getElementVisibilityRatio,
  open: visibleProp,
  destroyOnHidden = false,
  placement: initialPlacement = 'right',
  autoAdjustOverflow,
  ...props
}) => {
  const triggerElementRef = useRef<HTMLElement>();
  const [visible, setVisible] = useState(
    visibleProp === undefined ? props.defaultOpen : visibleProp,
  );
  const [placement, setPlacement] =
    React.useState<TooltipPlacement>(initialPlacement);

  const calculatePlacement = useCallback(() => {
    if (!triggerElementRef.current || !visible) return;

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
  }, [getVisibilityRatio, visible, placement]);

  const changeContainerScrollStatus = useCallback(
    (visible: boolean | undefined) => {
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
  const handleAfterOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        calculatePlacement();
      }
    },
    [calculatePlacement],
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
    if (!visible || !triggerElementRef.current) return () => {};

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        calculatePlacement();
      });
    });

    const intersectionObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            calculatePlacement();
          }
        });
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    resizeObserver.observe(
      triggerElementRef.current.parentElement || document.body,
    );
    intersectionObserver.observe(triggerElementRef.current);

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [visible, calculatePlacement]);

  return (
    <Popover
      {...props}
      open={visible}
      arrow={{ pointAtCenter: true }}
      autoAdjustOverflow={
        autoAdjustOverflow ?? getAutoAdjustOverflow(placement)
      }
      placement={placement}
      onOpenChange={handleOnVisibleChange}
      getPopupContainer={handleGetPopupContainer}
      destroyOnHidden={destroyOnHidden}
      afterOpenChange={handleAfterOpenChange}
      rootClassName="superset-explore-popover"
    />
  );
};

export default ControlPopover;
