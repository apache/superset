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

// --------------------
// VALID CONTROL PANELS
// --------------------
const fullControlPanel = {
  code: `
  export default {
    controlPanelSections: [
      {
        label: t('Chart'),
        controlSetRows: [['metric']],
      },
      {
        label: t('Time'),
        controlSetRows: [['granularity']],
      },
      {
        label: 'Some other section 1',
        controlSetRows: [['control']],
      },
      {
        label: 'Filter',
        controlSetRows: [['adhoc_filters']],
      },
      {
        label: 'Some other section 2',
        controlSetRows: [['control']],
      },
      {
        label: t('Advanced query settings'),
        controlSetRows: [['control']],
      },
      {
        label: 'Some other section 3',
        controlSetRows: [['control']],
      },
    ],
  };`,
};

const controlPanelWithNoTimeSection = {
  code: `
  export default {
    controlPanelSections: [
      {
        label: t('Chart'),
        controlSetRows: [['metric']],
      },
      {
        label: 'Some other section 1',
        controlSetRows: [['control']],
      },
      {
        label: 'Filter',
        controlSetRows: [['adhoc_filters']],
      },
      {
        label: 'Some other section 2',
        controlSetRows: [['control']],
      },
      {
        label: t('Chart settings'),
        controlSetRows: [['control']],
      },
      {
        label: 'Some other section 3',
        controlSetRows: [['control']],
      },
    ],
  };`,
};

const controlPanelWithNoFilterAndSettingsSection = {
  code: `
  export default {
    controlPanelSections: [
      {
        label: t('Chart'),
        controlSetRows: [['metric']],
      },
      {
        label: t('Time'),
        controlSetRows: [['granularity']],
      },
      {
        label: 'Some other section 1',
        controlSetRows: [['control']],
      },
      {
        label: 'Some other section 2',
        controlSetRows: [['control']],
      },
      {
        label: 'Some other section 3',
        controlSetRows: [['control']],
      },
    ],
  };`,
};

const fullControlPanelWithTableSection = {
  code: `
  export default {
    controlPanelSections: [
      {
        label: t('Table'),
        controlSetRows: [['metric']],
      },
      {
        label: t('Time'),
        controlSetRows: [['granularity']],
      },
      {
        label: 'Some other section 1',
        controlSetRows: [['control']],
      },
      {
        label: 'Filter',
        controlSetRows: [['adhoc_filters']],
      },
      {
        label: 'Some other section 2',
        controlSetRows: [['control']],
      },
      {
        label: t('Advanced query settings'),
        controlSetRows: [['control']],
      },
      {
        label: 'Some other section 3',
        controlSetRows: [['control']],
      },
    ],
  };`,
};

const controlPanelWithConfigAsVariable = {
  code: `
  const config = {
    controlPanelSections: [
      {
        label: t('Chart'),
        controlSetRows: [['metric']],
      },
      {
        label: t('Time'),
        controlSetRows: [['granularity']],
      },
      {
        label: 'Some other section 1',
        controlSetRows: [['control']],
      },
      {
        label: 'Some other section 2',
        controlSetRows: [['control']],
      },
      {
        label: 'Some other section 3',
        controlSetRows: [['control']],
      },
    ],
  };
  export default config;`,
};

const controlPanelWithExportAsDefault = {
  code: `
  const config = {
    controlPanelSections: [
      {
        label: t('Chart'),
        controlSetRows: [['metric']],
      },
      {
        label: t('Time'),
        controlSetRows: [['granularity']],
      },
      {
        label: 'Some other section 1',
        controlSetRows: [['control']],
      },
      {
        label: 'Some other section 2',
        controlSetRows: [['control']],
      },
      {
        label: 'Some other section 3',
        controlSetRows: [['control']],
      },
    ],
  };
  export { config as default };`,
};

// ----------------------
// INVALID CONTROL PANELS
// ----------------------
const controlPanelWithNoChartSection = {
  code: `
  export default {
    controlPanelSections: [
      {
        label: t('Query'),
        controlSetRows: [['metric']],
      },
      {
        label: t('Time'),
        controlSetRows: [['granularity']],
      },
      {
        label: 'Some other section 1',
        controlSetRows: [['control']],
      },
      {
        label: 'Filter',
        controlSetRows: [['adhoc_filters']],
      },
      {
        label: 'Some other section 2',
        controlSetRows: [['control']],
      },
      {
        label: t('Advanced query settings'),
        controlSetRows: [['control']],
      },
      {
        label: 'Some other section 3',
        controlSetRows: [['control']],
      },
    ],
  };`,
};

const controlPanelWithFilterBeforeTime = {
  code: `
  export default {
    controlPanelSections: [
      {
        label: t('Chart'),
        controlSetRows: [['metric']],
      },
      {
        label: 'Filter',
        controlSetRows: [['adhoc_filters']],
      },
      {
        label: t('Time'),
        controlSetRows: [['granularity']],
      },
      {
        label: 'Some other section 1',
        controlSetRows: [['control']],
      },
      {
        label: 'Some other section 2',
        controlSetRows: [['control']],
      },
      {
        label: t('Advanced query settings'),
        controlSetRows: [['control']],
      },
      {
        label: 'Some other section 3',
        controlSetRows: [['control']],
      },
    ],
  };`,
};

const controlPanelWithSettingsFirst = {
  code: `
  export default {
    controlPanelSections: [
      {
        label: t('Chart settings'),
        controlSetRows: [['control']],
      },
      {
        label: t('Chart'),
        controlSetRows: [['metric']],
      },
      {
        label: 'Filter',
        controlSetRows: [['adhoc_filters']],
      },
      {
        label: t('Time'),
        controlSetRows: [['granularity']],
      },
      {
        label: 'Some other section 1',
        controlSetRows: [['control']],
      },
      {
        label: 'Some other section 2',
        controlSetRows: [['control']],
      },
      {
        label: 'Some other section 3',
        controlSetRows: [['control']],
      },
    ],
  };`,
};

module.exports = {
  fullControlPanel,
  controlPanelWithNoTimeSection,
  controlPanelWithNoFilterAndSettingsSection,
  fullControlPanelWithTableSection,
  controlPanelWithConfigAsVariable,
  controlPanelWithExportAsDefault,
  controlPanelWithNoChartSection,
  controlPanelWithFilterBeforeTime,
  controlPanelWithSettingsFirst,
};
