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
/** Build the fixed punctuation and editable digit slots for a date format. */
export function dateInputMask(format: string): string {
  return format.replace(/[A-Za-z]/g, '_');
}

/** Overwrite or clear digit slots without moving the date's separators. */
export function editDateMask(
  text: string,
  mask: string,
  start: number,
  end: number,
  inserted = '',
  deletion?: 'backward' | 'forward',
): { text: string; caret: number } {
  const next = text.split('');
  const slots = Array.from(mask, (_, index) => index).filter(
    index => mask[index] === '_',
  );
  const selected = slots.filter(index => index >= start && index < end);
  selected.forEach(index => {
    next[index] = '_';
  });
  let caret = start;
  if (deletion && selected.length === 0) {
    const index =
      deletion === 'backward'
        ? slots.filter(position => position < start).pop()
        : slots.find(position => position >= start);
    if (index !== undefined) {
      next[index] = '_';
      caret = index;
    }
  }
  for (const digit of inserted.replace(/[^0-9]/g, '')) {
    const index = slots.find(position => position >= caret);
    if (index === undefined) break;
    next[index] = digit;
    caret = slots.find(position => position > index) ?? mask.length;
  }
  return { text: next.join(''), caret };
}
