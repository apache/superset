/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.
 */
import type { ComponentType, Layout } from 'src/dashboard/types';
import getComponentWidthFromDrop from './getComponentWidthFromDrop';

export interface DropResult {
  source: {
    id: string;
    index: number;
  };
  destination: {
    id: string;
    index: number;
  };
  dragging: {
    id: string;
    type: ComponentType;
  };
}

export default function doesChildOverflowParent(
  dropResult: DropResult,
  layout: Layout,
): boolean {
  const childWidth = getComponentWidthFromDrop({ dropResult, layout });

  return typeof childWidth === 'number' && childWidth < 0;
}
