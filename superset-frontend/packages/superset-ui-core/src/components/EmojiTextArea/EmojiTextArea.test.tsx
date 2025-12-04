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
import { render, screen, userEvent } from '@superset-ui/core/spec';
import { EmojiTextArea } from '.';
import { filterEmojis, EMOJI_DATA } from './emojiData';

test('renders EmojiTextArea with placeholder', () => {
  render(<EmojiTextArea placeholder="Type something..." />);
  expect(screen.getByPlaceholderText('Type something...')).toBeInTheDocument();
});

test('renders EmojiTextArea as textarea element', () => {
  render(<EmojiTextArea placeholder="Type here" />);
  const textarea = screen.getByPlaceholderText('Type here');
  expect(textarea.tagName.toLowerCase()).toBe('textarea');
});

test('allows typing in the textarea', async () => {
  render(<EmojiTextArea placeholder="Type here" />);
  const textarea = screen.getByPlaceholderText('Type here');
  await userEvent.type(textarea, 'Hello world');
  expect(textarea).toHaveValue('Hello world');
});

test('calls onChange when typing', async () => {
  const onChange = jest.fn();
  render(<EmojiTextArea placeholder="Type here" onChange={onChange} />);
  const textarea = screen.getByPlaceholderText('Type here');
  await userEvent.type(textarea, 'Hi');
  expect(onChange).toHaveBeenCalled();
});

test('passes through rows prop', () => {
  render(<EmojiTextArea placeholder="Type here" rows={5} />);
  const textarea = screen.getByPlaceholderText('Type here');
  expect(textarea).toHaveAttribute('rows', '5');
});

test('forwards ref to underlying component', () => {
  const ref = { current: null };
  render(<EmojiTextArea ref={ref} placeholder="Type here" />);
  expect(ref.current).not.toBeNull();
});

test('renders controlled component with value prop', () => {
  render(<EmojiTextArea value="Hello" onChange={() => {}} />);
  expect(screen.getByDisplayValue('Hello')).toBeInTheDocument();
});

// ============================================
// Unit tests for filterEmojis utility function
// ============================================

test('filterEmojis returns matching emojis by shortcode', () => {
  const results = filterEmojis('smile');
  expect(results.length).toBeGreaterThan(0);
  expect(results[0].shortcode).toBe('smile');
});

test('filterEmojis returns matching emojis by partial shortcode', () => {
  const results = filterEmojis('sm');
  expect(results.length).toBeGreaterThan(0);
  // Should include smile, smirk, etc.
  expect(results.some(e => e.shortcode.includes('sm'))).toBe(true);
});

test('filterEmojis returns matching emojis by keyword', () => {
  const results = filterEmojis('happy');
  expect(results.length).toBeGreaterThan(0);
  // Should include emojis with 'happy' keyword
  expect(results.some(e => e.keywords?.includes('happy'))).toBe(true);
});

test('filterEmojis is case insensitive', () => {
  const results1 = filterEmojis('SMILE');
  const results2 = filterEmojis('smile');
  expect(results1.length).toBe(results2.length);
  expect(results1[0].shortcode).toBe(results2[0].shortcode);
});

test('filterEmojis respects limit parameter', () => {
  const results = filterEmojis('a', 5);
  expect(results.length).toBeLessThanOrEqual(5);
});

test('filterEmojis returns empty array for empty search', () => {
  const results = filterEmojis('');
  expect(results).toEqual([]);
});

test('filterEmojis returns empty array for no matches', () => {
  const results = filterEmojis('zzzznotanemoji');
  expect(results).toEqual([]);
});

// ============================================
// Unit tests for EMOJI_DATA
// ============================================

test('EMOJI_DATA contains expected smileys', () => {
  const smile = EMOJI_DATA.find(e => e.shortcode === 'smile');
  expect(smile).toBeDefined();
  expect(smile?.emoji).toBe('😄');

  const joy = EMOJI_DATA.find(e => e.shortcode === 'joy');
  expect(joy).toBeDefined();
  expect(joy?.emoji).toBe('😂');
});

test('EMOJI_DATA contains expected gestures', () => {
  const thumbsup = EMOJI_DATA.find(e => e.shortcode === 'thumbsup');
  expect(thumbsup).toBeDefined();
  expect(thumbsup?.emoji).toBe('👍');

  const clap = EMOJI_DATA.find(e => e.shortcode === 'clap');
  expect(clap).toBeDefined();
  expect(clap?.emoji).toBe('👏');
});

test('EMOJI_DATA contains expected symbols', () => {
  const heart = EMOJI_DATA.find(e => e.shortcode === 'heart');
  expect(heart).toBeDefined();
  expect(heart?.emoji).toBe('❤️');

  const fire = EMOJI_DATA.find(e => e.shortcode === 'fire');
  expect(fire).toBeDefined();
  expect(fire?.emoji).toBe('🔥');

  const checkmark = EMOJI_DATA.find(e => e.shortcode === 'white_check_mark');
  expect(checkmark).toBeDefined();
  expect(checkmark?.emoji).toBe('✅');
});

test('EMOJI_DATA items have required properties', () => {
  EMOJI_DATA.forEach(item => {
    expect(item).toHaveProperty('shortcode');
    expect(item).toHaveProperty('emoji');
    expect(typeof item.shortcode).toBe('string');
    expect(typeof item.emoji).toBe('string');
    expect(item.shortcode.length).toBeGreaterThan(0);
    expect(item.emoji.length).toBeGreaterThan(0);
  });
});

test('EMOJI_DATA shortcodes are unique', () => {
  const shortcodes = EMOJI_DATA.map(e => e.shortcode);
  const uniqueShortcodes = new Set(shortcodes);
  expect(uniqueShortcodes.size).toBe(shortcodes.length);
});

test('EMOJI_DATA has a reasonable number of emojis', () => {
  // Ensure we have a substantial emoji set
  expect(EMOJI_DATA.length).toBeGreaterThan(100);
});
