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
import { t } from '@apache-superset/core';
import { Button, Icons } from '@superset-ui/core/components';

interface TranslationButtonProps {
  /** Number of locales that have translations. */
  translationCount: number;
  /** Handler invoked when the button is clicked. */
  onClick: () => void;
  /** Disables the button when the user lacks edit permission. */
  disabled?: boolean;
}

/**
 * Button that displays translation count and opens the translation editor.
 * Placed next to translatable fields (title, description, filter name).
 */
export default function TranslationButton({
  translationCount,
  onClick,
  disabled = false,
}: TranslationButtonProps) {
  return (
    <Button
      buttonSize="small"
      onClick={onClick}
      disabled={disabled}
    >
      <Icons.GlobalOutlined iconSize="s" />
      {t('Translations (%s)', translationCount)}
    </Button>
  );
}
