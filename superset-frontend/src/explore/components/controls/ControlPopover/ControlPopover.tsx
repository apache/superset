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
import React, { useCallback, useRef, useEffect } from 'react';

import Popover, {
  PopoverProps as BasePopoverProps,
  TooltipPlacement,
} from 'src/components/Popover';

const sectionContainerId = 'controlSections';
const getSectionContainerElement = () =>
  document.getElementById(sectionContainerId)?.parentElement;

const getElementYVisibilityRatioOnContainer = (node: HTMLElement) => {
  const containerHeight = window?.innerHeight;
  const nodePositionInViewport = node.getBoundingClientRect()?.top;
  if (!containerHeight || !nodePositionInViewport) {
    return 0;
  }

  return nodePositionInViewport / containerHeight;
};

export type PopoverProps = BasePopoverProps & {
  getVisibilityRatio?: typeof getElementYVisibilityRatioOnContainer;
};

const ControlPopover: React.FC<PopoverProps> = ({
  getPopupContainer,
  getVisibilityRatio = getElementYVisibilityRatioOnContainer,
  ...props
}) => {
  const triggerElementRef = useRef<HTMLElement>();
  const [placement, setPlacement] = React.useState<TooltipPlacement>('right');

  const calculatePlacement = useCallback(() => {
    const visibilityRatio = getVisibilityRatio(triggerElementRef.current!);

    if (visibilityRatio < 0.35) {
      setPlacement('rightTop');
    } else if (visibilityRatio > 0.65) {
      setPlacement('rightBottom');
    } else {
      setPlacement('right');
    }
  }, [getVisibilityRatio]);

  const changeContainerScrollStatus = useCallback(
    visible => {
      if (triggerElementRef.current && visible) {
        calculatePlacement();
      }

      const element = getSectionContainerElement();
      if (element) {
        element.style.overflowY = visible ? 'hidden' : 'auto';
      }
    },
    [calculatePlacement],
  );

  const handleGetPopupContainer = useCallback(
    (triggerNode: HTMLElement) => {
      triggerElementRef.current = triggerNode;
      setTimeout(() => {
        calculatePlacement();
      }, 0);

      return getPopupContainer?.(triggerNode) || document.body;
    },
    [calculatePlacement, getPopupContainer],
  );

  const handleOnVisibleChange = useCallback(
    (visible: boolean) => {
      if (props.visible === undefined) {
        changeContainerScrollStatus(visible);
      }

      props.onVisibleChange?.(visible);
    },
    [props, changeContainerScrollStatus],
  );

  useEffect(() => {
    if (props.visible !== undefined) {
      changeContainerScrollStatus(props.visible);
    }
  }, [props.visible, changeContainerScrollStatus]);

  return (
    <Popover
      {...props}
      arrowPointAtCenter
      placement={placement}
      onVisibleChange={handleOnVisibleChange}
      getPopupContainer={handleGetPopupContainer}
    />
  );
};

export default ControlPopover;
