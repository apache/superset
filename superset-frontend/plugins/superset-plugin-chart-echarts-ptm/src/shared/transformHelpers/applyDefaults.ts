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
import merge from 'lodash.merge';
import { getMergeStrategy, type MergeStrategy } from './echartsSchema';

interface EchartOptions {
  series?: Record<string, unknown>[];
  xAxis?: Record<string, unknown> | Record<string, unknown>[];
  yAxis?: Record<string, unknown> | Record<string, unknown>[];
  [key: string]: unknown;
}

/**
 * Schema source: https://echarts.apache.org/en/option.html
 */
export function applyAllDefaults(
  options: EchartOptions,
  ptmDefaults: Record<string, unknown>,
): EchartOptions {
  let result = { ...options };

  for (const [propertyName, defaultValue] of Object.entries(ptmDefaults)) {
    if (defaultValue === undefined) continue;

    const currentValue = result[propertyName];
    const strategy = getMergeStrategy(propertyName);

    result = applyMergeStrategy(
      result,
      propertyName,
      currentValue,
      defaultValue,
      strategy,
    );
  }

  return result;
}


function applyMergeStrategy(
  options: EchartOptions,
  propertyName: string,
  currentValue: unknown,
  defaultValue: unknown,
  strategy: MergeStrategy,
): EchartOptions {
  switch (strategy) {
    case 'merge-into-items':
      return applyMergeIntoItems(options, propertyName, currentValue, defaultValue);
    
    case 'deep-merge':
      return applyDeepMerge(options, propertyName, currentValue, defaultValue);
    
    case 'set-if-missing':
      return applySetIfMissing(options, propertyName, currentValue, defaultValue);
    
    case 'replace':
      return applyReplace(options, propertyName, defaultValue);
    
    default:
      // Unknown strategy, default to deep merge (safe fallback)
      return applyDeepMerge(options, propertyName, currentValue, defaultValue);
  }
}


function applyMergeIntoItems(
  options: EchartOptions,
  propertyName: string,
  currentValue: unknown,
  defaultValue: unknown,
): EchartOptions {
  if (Array.isArray(currentValue)) {
    return mergeIntoEachArrayItem(options, propertyName, currentValue, defaultValue);
  }
  
  if (currentValue !== undefined && typeof currentValue === 'object' && typeof defaultValue === 'object') {
    return {
      ...options,
      [propertyName]: merge({}, currentValue as Record<string, unknown>, defaultValue as Record<string, unknown>),
    };
  }
  
  if (currentValue === undefined) {
    return {
      ...options,
      [propertyName]: defaultValue,
    };
  }

  return options;
}


function applyDeepMerge(
  options: EchartOptions,
  propertyName: string,
  currentValue: unknown,
  defaultValue: unknown,
): EchartOptions {
  if (currentValue !== undefined && typeof currentValue === 'object' && typeof defaultValue === 'object') {
    const merged = merge({}, currentValue as Record<string, unknown>, defaultValue as Record<string, unknown>);
 
    return {
      ...options,
      [propertyName]: merged,
    };
  }
  
  if (currentValue === undefined) {

    return {
      ...options,
      [propertyName]: defaultValue,
    };
  }

  return options;
}


function applySetIfMissing(
  options: EchartOptions,
  propertyName: string,
  currentValue: unknown,
  defaultValue: unknown,
): EchartOptions {
  if (currentValue === undefined) {

    return {
      ...options,
      [propertyName]: defaultValue,
    };
  }

  return options;
}


function applyReplace(
  options: EchartOptions,
  propertyName: string,
  defaultValue: unknown,
): EchartOptions {

  return {
    ...options,
    [propertyName]: defaultValue,
  };
}


function mergeIntoEachArrayItem(
  options: EchartOptions,
  propertyName: string,
  currentArray: Record<string, unknown>[],
  defaultValue: unknown,
): EchartOptions {
  const defaultStyle = Array.isArray(defaultValue) ? defaultValue[0] : defaultValue;
  
  if (!defaultStyle || typeof defaultStyle !== 'object') {
    return options;
  }

  const mergedArray = currentArray.map((item: Record<string, unknown>) =>
    merge({}, defaultStyle as Record<string, unknown>, item)
  );

  return {
    ...options,
    [propertyName]: mergedArray,
  };
}
