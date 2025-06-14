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
/* eslint-disable theme-colors/no-literal-colors */
import { useEffect, useRef, useState, cloneElement } from 'react';
import { styled } from '@superset-ui/core';

const PopoverWrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const PopoverContainer = styled.div`
  position: fixed;
  background: #f8f8f8;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 99999;
  min-width: 200px;
  padding: 8px;
`;

interface Props {
  content: React.ReactNode;
  children: React.ReactElement;
  isOpen: boolean;
  onClose: () => void;
}

const CustomPopover: React.FC<Props> = ({
  content,
  children,
  isOpen,
  onClose,
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) {
        setPosition({
          top: rect.bottom + 8,
          left: Math.max(
            0,
            rect.right - (popoverRef.current?.offsetWidth || 0),
          ),
        });
      }
    };

    if (isOpen) {
      updatePosition();
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', updatePosition);
      window.addEventListener('resize', updatePosition);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  const handleClickOutside = (event: MouseEvent) => {
    if (
      popoverRef.current &&
      !popoverRef.current.contains(event.target as Node) &&
      !triggerRef.current?.contains(event.target as Node)
    ) {
      onClose();
    }
  };

  return (
    <PopoverWrapper>
      {cloneElement(children, { ref: triggerRef })}
      {isOpen && (
        <PopoverContainer
          ref={popoverRef}
          style={{
            top: `${position.top}px`,
            left: `${position.left + 10}px`,
          }}
        >
          {content}
        </PopoverContainer>
      )}
    </PopoverWrapper>
  );
};

export default CustomPopover;
