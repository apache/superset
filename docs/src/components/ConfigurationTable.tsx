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

import React, { useState, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent, GridApi, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-material.css';
import configMetadata from '../resources/config_metadata.json';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// ConfigSetting interface is defined for type safety but not directly used
// as AG Grid uses dynamic property access
// interface ConfigSetting {
//   key: string;
//   title: string;
//   description: string;
//   details: string;
//   type: string;
//   category: string;
//   group: string;
//   default: any;
//   env_var: string;
//   external: boolean;
//   source: string;
//   supports_callable: boolean;
// }

interface ConfigurationTableProps {
  category?: string;
  showEnvironmentVariables?: boolean;
}

// Custom cell renderers

const KeyCellRenderer = (props: { value: string }) => {
  return <span style={{ fontWeight: 'bold' }}>{props.value}</span>;
};

const TypeCellRenderer = (props: { value: string }) => {
  return <code>{props.value}</code>;
};

const DefaultCellRenderer = (props: { value: unknown }) => {
  const formatDefault = (value: unknown): string => {
    if (value === null || value === undefined || value === 'None') return 'None';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const formatted = formatDefault(props.value);
  const isLong = formatted.length > 50;

  return (
    <code
      style={{
        whiteSpace: isLong ? 'pre-wrap' : 'nowrap',
        wordBreak: isLong ? 'break-all' : 'normal',
      }}
      title={isLong ? formatted : undefined}
    >
      {isLong ? formatted.substring(0, 50) + '...' : formatted}
    </code>
  );
};

const BooleanCellRenderer = (props: { value: boolean }) => {
  return props.value ? '✅ Yes' : '❌ No';
};

const GroupCellRenderer = (props: { value: string | null }) => {
  if (!props.value) return null;
  return (
    <span
      style={{
        backgroundColor: '#f0f0f0',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '0.9em',
      }}
    >
      {props.value}
    </span>
  );
};

const DescriptionCellRenderer = (props: { value: string; data: { details?: string } }) => {
  const hasDetails = props.data.details && props.data.details.trim() !== '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span>{props.value || 'No description available'}</span>
      {hasDetails && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '16px',
            height: '16px',
            backgroundColor: '#e8e8e8',
            color: '#666',
            borderRadius: '50%',
            fontSize: '0.8em',
            fontWeight: 'bold',
            cursor: 'help',
            flexShrink: 0,
            border: '1px solid #d0d0d0',
          }}
          title={props.data.details}
        >
          i
        </span>
      )}
    </div>
  );
};

const ConfigurationTable: React.FC<ConfigurationTableProps> = ({
  category, // eslint-disable-line @typescript-eslint/no-unused-vars
  showEnvironmentVariables = false,
}) => {
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [searchText, setSearchText] = useState('');

  // Process data to include only enriched configs
  const rowData = useMemo(() => {
    return configMetadata.all_settings;
  }, []);

  // Column definitions
  const columnDefs = useMemo<ColDef[]>(() => {
    const columns: ColDef[] = [
      {
        field: 'key',
        headerName: 'Configuration Key',
        cellRenderer: KeyCellRenderer,
        width: 280,
        pinned: 'left',
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'description',
        headerName: 'Description',
        cellRenderer: DescriptionCellRenderer,
        flex: 2,
        minWidth: 300,
        wrapText: true,
        autoHeight: true,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'type',
        headerName: 'Type',
        cellRenderer: TypeCellRenderer,
        width: 120,
        filter: 'agTextColumnFilter',
      },
      {
        field: 'default',
        headerName: 'Default',
        cellRenderer: DefaultCellRenderer,
        width: 200,
        filter: 'agTextColumnFilter',
      },
      {
        field: 'category',
        headerName: 'Category',
        width: 120,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'group',
        headerName: 'Group',
        cellRenderer: GroupCellRenderer,
        width: 180,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
    ];

    if (showEnvironmentVariables) {
      columns.push({
        field: 'env_var',
        headerName: 'Environment Variable',
        width: 250,
        filter: 'agTextColumnFilter',
        cellRenderer: (props: { value: string }) => (
          <code>{props.value}</code>
        ),
      });
    }

    columns.push(
      {
        field: 'external',
        headerName: 'External',
        cellRenderer: BooleanCellRenderer,
        width: 100,
        filter: true,
      },
    );

    return columns;
  }, [showEnvironmentVariables]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    resizable: true,
  }), []);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  const onFilterTextBoxChanged = useCallback(() => {
    if (gridApi) {
      gridApi.setGridOption('quickFilterText', searchText);
    }
  }, [gridApi, searchText]);

  const exportToCsv = useCallback(() => {
    if (gridApi) {
      gridApi.exportDataAsCsv({
        fileName: 'superset_configuration.csv',
      });
    }
  }, [gridApi]);

  return (
    <div style={{ width: '100%', height: '800px' }}>
      {/* Controls */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            placeholder="Quick filter across all columns..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              onFilterTextBoxChanged();
            }}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              width: '100%',
              maxWidth: '400px',
            }}
          />
        </div>

        <button
          onClick={exportToCsv}
          style={{
            padding: '8px 16px',
            backgroundColor: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Export to CSV
        </button>

        <div style={{ color: '#666' }}>
          {rowData.length} configurations
        </div>
      </div>

      {/* AG Grid */}
      <div className="ag-theme-material" style={{ height: '100%', width: '100%' }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          animateRows={true}
          enableCellTextSelection={true}
          ensureDomOrder={true}
          tooltipShowDelay={500}
          pagination={true}
          paginationPageSize={50}
          paginationPageSizeSelector={[20, 50, 100, 200]}
        />
      </div>

      {/* Help text */}
      <div style={{ marginTop: '15px', color: '#666' }}>
        <p>
          <strong>Tips:</strong> Click column headers to sort. Use the filter row below headers for column-specific filtering.
          Hold Shift to sort by multiple columns. Right-click headers for more options.
        </p>
      </div>
    </div>
  );
};


export default ConfigurationTable;
