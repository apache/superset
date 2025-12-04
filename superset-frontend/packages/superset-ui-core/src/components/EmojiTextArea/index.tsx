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
import { forwardRef, useCallback, useMemo, useState, useRef } from 'react';
import { Mentions } from 'antd';
import type { MentionsRef, MentionsProps } from 'antd/es/mentions';
import { filterEmojis, type EmojiItem } from './emojiData';

const MIN_CHARS_BEFORE_POPUP = 2;

// Regex to match emoji characters (simplified, covers most common emojis)
const EMOJI_REGEX =
  /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u;

export interface EmojiTextAreaProps
  extends Omit<MentionsProps, 'prefix' | 'options' | 'onSelect'> {
  /**
   * Minimum characters after colon before showing popup.
   * @default 2 (Slack-like behavior)
   */
  minCharsBeforePopup?: number;
  /**
   * Maximum number of emoji suggestions to show.
   * @default 10
   */
  maxSuggestions?: number;
  /**
   * Called when an emoji is selected from the popup.
   */
  onEmojiSelect?: (emoji: EmojiItem) => void;
}

/**
 * A TextArea component with Slack-like emoji autocomplete.
 *
 * Features:
 * - Triggers on `:` prefix (like Slack)
 * - Only shows popup after 2+ characters are typed (configurable)
 * - Colon must be preceded by a space, start of line, or another emoji
 * - Prevents accidental Enter key selection when typing quickly
 *
 * @example
 * ```tsx
 * <EmojiTextArea
 *   placeholder="Type :sm to see emoji suggestions..."
 *   onChange={(text) => console.log(text)}
 * />
 * ```
 */
export const EmojiTextArea = forwardRef<MentionsRef, EmojiTextAreaProps>(
  (
    {
      minCharsBeforePopup = MIN_CHARS_BEFORE_POPUP,
      maxSuggestions = 10,
      onEmojiSelect,
      onChange,
      onKeyDown,
      ...restProps
    },
    ref,
  ) => {
    const [options, setOptions] = useState<
      Array<{ value: string; label: React.ReactNode }>
    >([]);
    const [isPopupVisible, setIsPopupVisible] = useState(false);
    const lastSearchRef = useRef<string>('');
    const lastKeyPressTimeRef = useRef<number>(0);

    /**
     * Validates whether the colon trigger should activate the popup.
     * Implements Slack-like behavior:
     * - Colon must be preceded by whitespace, start of text, or emoji
     * - At least minCharsBeforePopup characters must be typed after colon
     */
    const validateSearch = useCallback(
      (text: string, props: MentionsProps): boolean => {
        // Get the full value to check what precedes the colon
        const fullValue = (props.value as string) || '';

        // Find where this search text starts in the full value
        // The search text is what comes after the `:` prefix
        const colonIndex = fullValue.lastIndexOf(`:${text}`);

        if (colonIndex === -1) {
          setIsPopupVisible(false);
          return false;
        }

        // Check what precedes the colon
        if (colonIndex > 0) {
          const charBefore = fullValue[colonIndex - 1];

          // Must be preceded by whitespace, newline, or emoji
          const isWhitespace = /\s/.test(charBefore);
          const isEmoji = EMOJI_REGEX.test(charBefore);

          if (!isWhitespace && !isEmoji) {
            setIsPopupVisible(false);
            return false;
          }
        }

        // Check minimum character requirement
        if (text.length < minCharsBeforePopup) {
          setIsPopupVisible(false);
          return false;
        }

        setIsPopupVisible(true);
        return true;
      },
      [minCharsBeforePopup],
    );

    /**
     * Handles search and filters emoji suggestions.
     */
    const handleSearch = useCallback(
      (searchText: string) => {
        lastSearchRef.current = searchText;

        if (searchText.length < minCharsBeforePopup) {
          setOptions([]);
          return;
        }

        const filteredEmojis = filterEmojis(searchText, maxSuggestions);

        const newOptions = filteredEmojis.map(item => ({
          value: item.emoji,
          label: (
            <span>
              <span style={{ marginRight: 8 }}>{item.emoji}</span>
              <span style={{ color: 'var(--ant-color-text-secondary)' }}>
                :{item.shortcode}:
              </span>
            </span>
          ),
          // Store the full item for onSelect callback
          data: item,
        }));

        setOptions(newOptions);
      },
      [minCharsBeforePopup, maxSuggestions],
    );

    /**
     * Handles emoji selection from the popup.
     */
    const handleSelect = useCallback(
      (option: { value: string; data?: EmojiItem }) => {
        if (option.data && onEmojiSelect) {
          onEmojiSelect(option.data);
        }
        setIsPopupVisible(false);
      },
      [onEmojiSelect],
    );

    /**
     * Handles key down events to prevent accidental selection on Enter.
     * If the user presses Enter very quickly after typing (< 100ms),
     * we treat it as a newline intent rather than selection.
     */
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const now = Date.now();
        const timeSinceLastKey = now - lastKeyPressTimeRef.current;

        // If Enter is pressed and popup is visible
        if (e.key === 'Enter' && isPopupVisible) {
          // If typed very quickly (< 100ms since last keypress) and
          // there's meaningful search text, allow the Enter to create newline
          // This prevents accidental selection when typing something like:
          // "let me show you an example:[Enter]"
          if (timeSinceLastKey < 100 && lastSearchRef.current.length === 0) {
            // Let the default behavior (newline) happen
            setIsPopupVisible(false);
            return;
          }
        }

        lastKeyPressTimeRef.current = now;

        // Call original onKeyDown if provided
        onKeyDown?.(e);
      },
      [isPopupVisible, onKeyDown],
    );

    const handleChange = useCallback(
      (text: string) => {
        lastKeyPressTimeRef.current = Date.now();
        onChange?.(text);
      },
      [onChange],
    );

    // Memoize the Mentions component props
    const mentionsProps = useMemo(
      () => ({
        prefix: ':',
        split: '',
        options,
        validateSearch,
        onSearch: handleSearch,
        onSelect: handleSelect,
        onKeyDown: handleKeyDown,
        onChange: handleChange,
        notFoundContent: null, // Don't show "Not Found" message
        ...restProps,
      }),
      [
        options,
        validateSearch,
        handleSearch,
        handleSelect,
        handleKeyDown,
        handleChange,
        restProps,
      ],
    );

    return <Mentions ref={ref} {...mentionsProps} />;
  },
);

EmojiTextArea.displayName = 'EmojiTextArea';

export type { EmojiItem };
export { filterEmojis, EMOJI_DATA } from './emojiData';
