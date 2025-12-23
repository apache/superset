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


const PILL_PALETTE: Array<{ bg: string; text: string }> = [
  { bg: '#DBEAFE', text: '#1E40AF' }, // Blue
  { bg: '#DEF7EC', text: '#03543F' }, // Green
  { bg: '#FEF3C7', text: '#92400E' }, // Amber
  { bg: '#FDE8E8', text: '#9B1C1C' }, // Red
  { bg: '#E0E7FF', text: '#3730A3' }, // Indigo
  { bg: '#FCE7F3', text: '#9D174D' }, // Pink
  { bg: '#D1FAE5', text: '#065F46' }, // Emerald
  { bg: '#FEE2E2', text: '#991B1B' }, // Rose
  { bg: '#E0F2FE', text: '#075985' }, // Sky
  { bg: '#F3E8FF', text: '#6B21A8' }, // Purple
  { bg: '#CCFBF1', text: '#115E59' }, // Teal
  { bg: '#FEF9C3', text: '#854D0E' }, // Yellow
  { bg: '#FFE4E6', text: '#BE123C' }, // Rose alt
  { bg: '#CFFAFE', text: '#0E7490' }, // Cyan
  { bg: '#F5F3FF', text: '#5B21B6' }, // Violet
  { bg: '#ECFCCB', text: '#3F6212' }, // Lime
];

const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

export const getPillColors = (value: string): { bg: string; text: string } => {
  if (value === null || value === undefined || value === '') {
    return { bg: '#F3F4F6', text: '#6B7280' };
  }
  const hash = hashString(String(value).toLowerCase().trim());
  return PILL_PALETTE[hash % PILL_PALETTE.length];
};

export function formatValueAsPill(value: any): string {
  if (value === null || value === undefined || value === '') {
    return `<span class="ptm-pill ptm-pill-empty">${value || '—'}</span>`;
  }
  
  if (typeof value === 'string' && (value.includes('<') || value.includes('&lt;'))) {
    return value;
  }
  
  if (typeof value === 'number' || !isNaN(Number(value))) {
    return String(value);
  }
  
  const { bg, text } = getPillColors(String(value));
  return `<span class="ptm-pill" style="background: ${bg}; color: ${text};">${value}</span>`;
}

export function applyPillFormatting(
  data: any[],
  columns: any[],
  formData: Record<string, unknown>,
): any[] {
  if (!data || !columns) return data;
  
  const specifiedColumns = (formData as any).ptmPillColumns as string[] | undefined;
  
  if (!specifiedColumns || specifiedColumns.length === 0) {
    return data;
  }
  
  return data.map((row: any) => {
    const newRow = { ...row };
    specifiedColumns.forEach((key: string) => {
      if (newRow[key] !== undefined) {
        newRow[key] = formatValueAsPill(newRow[key]);
      }
    });
    return newRow;
  });
}


