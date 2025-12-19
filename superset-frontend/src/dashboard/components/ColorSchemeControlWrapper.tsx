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
/* eslint-env browser */
import { getCategoricalSchemeRegistry, t } from '@superset-ui/core';
import { useEffect, useState } from 'react';
import ColorSchemeControl from 'src/explore/components/controls/ColorSchemeControl';

interface ColorSchemeControlWrapperProps {
  colorScheme?: string;
  hasCustomLabelsColor: boolean;
  hovered?: boolean;
  onChange: () => void;
}

const ColorSchemeControlWrapper = ({
  colorScheme,
  hasCustomLabelsColor = false,
  hovered = false,
  onChange = () => {},
}: ColorSchemeControlWrapperProps) => {
  const [choices, setChoices] = useState<string[][]>([]);
  const [schemes, setSchemes] = useState({});

  useEffect(() => {
    // Registry initialization
    const categoricalSchemeRegistry = getCategoricalSchemeRegistry();
    setChoices(categoricalSchemeRegistry.keys().map(s => [s, s]));
    setSchemes(categoricalSchemeRegistry.getMap());
  }, []); // Empty dependency array ensures this runs only once

  return (
    <ColorSchemeControl
      description={t(
        "Any color palette selected here will override the colors applied to this dashboard's individual charts",
      )}
      name="color_scheme"
      onChange={onChange}
      value={colorScheme ?? ''}
      choices={choices}
      clearable
      hovered={hovered}
      schemes={schemes}
      hasCustomLabelsColor={hasCustomLabelsColor}
    />
  );
};

export default ColorSchemeControlWrapper;
