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

import React from 'react';
import { render, act, screen, fireEvent } from 'spec/helpers/testing-library';
import { SupersetClient } from '@superset-ui/core';
import DatabaseSelector from '.';

const SupersetClientGet = jest.spyOn(SupersetClient, 'get');

let defaultProps: any = {
  dbId: 123,
  formMode: true,
  isDatabaseSelectEnabled: false,
  readOnly: false,
  sqlLabMode: false,
  schema: 'schema',
  getDbList: jest.fn(),
  getTableList: jest.fn(),
  handleError: jest.fn(),
  onDbChange: jest.fn(),
  onSchemaChange: jest.fn(),
  onSchemasLoad: jest.fn(),
  onChange: jest.fn(),
};

jest.mock('./DatabaseSelect', () => ({
  DatabaseSelect: (props: any) => (
    <div
      data-test="DatabaseSelect"
      data-disablefilters={props.disableFilters}
      data-isdisabled={props.isDisabled ? 'true' : 'false'}
      data-currentdbid={props.currentDbId}
    >
      <button
        data-test="DatabaseSelect-handleError"
        type="button"
        onClick={() => props.handleError('Error')}
      >
        handleError
      </button>
      <button
        data-test="DatabaseSelect-onChange"
        type="button"
        onClick={() => props.onChange()}
      >
        onChange
      </button>
      <button
        data-test="DatabaseSelect-mutator"
        type="button"
        onClick={() =>
          props.mutator.current({ result: ['information_schema', 'public'] })
        }
      >
        mutator
      </button>
    </div>
  ),
}));

jest.mock('./SchemaSelect', () => ({
  SchemaSelect: (props: any) => (
    <div
      data-test="SchemaSelect"
      data-schemaoptions={JSON.stringify(props.schemaOptions)}
      data-currentschema={props.currentSchema}
      data-hasrefresh={props.hasRefresh ? 'true' : 'false'}
      data-loading={props.loading ? 'true' : 'false'}
      data-readonly={props.readOnly ? 'true' : 'false'}
    >
      <button
        data-test="SchemaSelect-refresh"
        type="button"
        onClick={() => props.refresh()}
      >
        refresh
      </button>
      <button
        data-test="SchemaSelect-onChange"
        type="button"
        onClick={() => props.onChange()}
      >
        onChange
      </button>
    </div>
  ),
}));

describe('Should render all components', () => {
  beforeAll(() => {
    SupersetClientGet.mockResolvedValue({
      json: { result: ['information_schema', 'public'] },
    } as any);
  });

  beforeEach(() => {
    defaultProps = {
      dbId: 123,
      formMode: true,
      isDatabaseSelectEnabled: false,
      readOnly: false,
      sqlLabMode: false,
      schema: 'schema',
      getDbList: jest.fn(),
      getTableList: jest.fn(),
      handleError: jest.fn(),
      onDbChange: jest.fn(),
      onSchemaChange: jest.fn(),
      onSchemasLoad: jest.fn(),
      onChange: jest.fn(),
    };
  });

  it('Should render all components', async () => {
    const props = { ...defaultProps };
    await act(async () => {
      render(<DatabaseSelector {...props} />);
    });
    expect(props.getDbList).toBeCalledTimes(0);
    expect(props.getTableList).toBeCalledTimes(0);
    expect(props.handleError).toBeCalledTimes(0);
    expect(props.onDbChange).toBeCalledTimes(0);
    expect(props.onSchemaChange).toBeCalledTimes(0);
    expect(props.onSchemasLoad).toBeCalledTimes(1);
    expect(props.onChange).toBeCalledTimes(0);

    expect(screen.getByText('datasource')).toBeInTheDocument();
    expect(screen.getByText('schema')).toBeInTheDocument();

    expect(screen.getByTestId('DatabaseSelect')).toBeInTheDocument();
    expect(screen.getByTestId('SchemaSelect')).toBeInTheDocument();
  });

  it('Should not show labels when formMode:false', async () => {
    const props = { ...defaultProps, formMode: false };
    await act(async () => {
      render(<DatabaseSelector {...props} />);
    });

    expect(screen.queryByText('datasource')).not.toBeInTheDocument();
    expect(screen.queryByText('schema')).not.toBeInTheDocument();

    expect(screen.getByTestId('DatabaseSelect')).toBeInTheDocument();
    expect(screen.getByTestId('SchemaSelect')).toBeInTheDocument();
  });

  describe('Should render DatabaseSelect correctly', () => {
    describe('Should disableFilters=formMode || !sqlLabMode', () => {
      it('formMode:false sqlLabMode:false | disableFilters:true', async () => {
        const props = { ...defaultProps, formMode: false, sqlLabMode: false };
        await act(async () => {
          render(<DatabaseSelector {...props} />);
        });

        expect(screen.getByTestId('DatabaseSelect')).toBeInTheDocument();
        expect(screen.getByTestId('DatabaseSelect')).toHaveAttribute(
          'data-disablefilters',
          'true',
        );
      });
      it('formMode:false sqlLabMode:true | disableFilters:false', async () => {
        const props = { ...defaultProps, formMode: false, sqlLabMode: true };
        await act(async () => {
          render(<DatabaseSelector {...props} />);
        });

        expect(screen.getByTestId('DatabaseSelect')).toBeInTheDocument();
        expect(screen.getByTestId('DatabaseSelect')).toHaveAttribute(
          'data-disablefilters',
          'false',
        );
      });
      it('formMode:true sqlLabMode:false | disableFilters:true', async () => {
        const props = { ...defaultProps, formMode: true, sqlLabMode: false };
        await act(async () => {
          render(<DatabaseSelector {...props} />);
        });

        expect(screen.getByTestId('DatabaseSelect')).toBeInTheDocument();
        expect(screen.getByTestId('DatabaseSelect')).toHaveAttribute(
          'data-disablefilters',
          'true',
        );
      });
      it('formMode:true sqlLabMode:true | disableFilters:true', async () => {
        const props = { ...defaultProps, formMode: true, sqlLabMode: true };
        await act(async () => {
          render(<DatabaseSelector {...props} />);
        });

        expect(screen.getByTestId('DatabaseSelect')).toBeInTheDocument();
        expect(screen.getByTestId('DatabaseSelect')).toHaveAttribute(
          'data-disablefilters',
          'true',
        );
      });
      it('formMode:undefined(false) sqlLabMode:undefined(false) | disableFilters:true', async () => {
        const props = {
          ...defaultProps,
          formMode: undefined,
          sqlLabMode: undefined,
        };
        await act(async () => {
          render(<DatabaseSelector {...props} />);
        });

        expect(screen.getByTestId('DatabaseSelect')).toBeInTheDocument();
        expect(screen.getByTestId('DatabaseSelect')).toHaveAttribute(
          'data-disablefilters',
          'true',
        );
      });
    });

    describe('Should isDisabled=!isDatabaseSelectEnabled || readOnly', () => {
      it('isDatabaseSelectEnabled:false readOnly:false | isDisabled:true', async () => {
        const props = {
          ...defaultProps,
          isDatabaseSelectEnabled: false,
          readOnly: false,
        };
        await act(async () => {
          render(<DatabaseSelector {...props} />);
        });

        expect(screen.getByTestId('DatabaseSelect')).toBeInTheDocument();
        expect(screen.getByTestId('DatabaseSelect')).toHaveAttribute(
          'data-isdisabled',
          'true',
        );
      });
      it('isDatabaseSelectEnabled:false readOnly:true | isDisabled:true', async () => {
        const props = {
          ...defaultProps,
          isDatabaseSelectEnabled: false,
          readOnly: true,
        };
        await act(async () => {
          render(<DatabaseSelector {...props} />);
        });

        expect(screen.getByTestId('DatabaseSelect')).toBeInTheDocument();
        expect(screen.getByTestId('DatabaseSelect')).toHaveAttribute(
          'data-isdisabled',
          'true',
        );
      });
      it('isDatabaseSelectEnabled:true readOnly:false | isDisabled:false', async () => {
        const props = {
          ...defaultProps,
          isDatabaseSelectEnabled: true,
          readOnly: false,
        };
        await act(async () => {
          render(<DatabaseSelector {...props} />);
        });

        expect(screen.getByTestId('DatabaseSelect')).toBeInTheDocument();
        expect(screen.getByTestId('DatabaseSelect')).toHaveAttribute(
          'data-isdisabled',
          'false',
        );
      });
      it('isDatabaseSelectEnabled:true readOnly:true | isDisabled:true', async () => {
        const props = {
          ...defaultProps,
          isDatabaseSelectEnabled: true,
          readOnly: true,
        };
        await act(async () => {
          render(<DatabaseSelector {...props} />);
        });

        expect(screen.getByTestId('DatabaseSelect')).toBeInTheDocument();
        expect(screen.getByTestId('DatabaseSelect')).toHaveAttribute(
          'data-isdisabled',
          'true',
        );
      });
      it('isDatabaseSelectEnabled:undefined(true) readOnly:undefined(false) | isDisabled:false', async () => {
        const props = {
          ...defaultProps,
          isDatabaseSelectEnabled: undefined,
          readOnly: undefined,
        };
        await act(async () => {
          render(<DatabaseSelector {...props} />);
        });

        expect(screen.getByTestId('DatabaseSelect')).toBeInTheDocument();
        expect(screen.getByTestId('DatabaseSelect')).toHaveAttribute(
          'data-isdisabled',
          'false',
        );
      });
    });

    it('Should call props correctly', async () => {
      const props = {
        ...defaultProps,
        isDatabaseSelectEnabled: false,
        readOnly: false,
      };
      await act(async () => {
        render(<DatabaseSelector {...props} />);
      });

      expect(screen.getByTestId('DatabaseSelect')).toHaveAttribute(
        'data-currentdbid',
        '123',
      );

      expect(props.getDbList).toBeCalledTimes(0);
      expect(props.getTableList).toBeCalledTimes(0);
      expect(props.handleError).toBeCalledTimes(0);
      expect(props.onDbChange).toBeCalledTimes(0);
      expect(props.onSchemaChange).toBeCalledTimes(0);
      expect(props.onSchemasLoad).toBeCalledTimes(1);
      expect(props.onChange).toBeCalledTimes(0);

      fireEvent.click(screen.getByTestId('DatabaseSelect-handleError'));
      expect(props.getDbList).toBeCalledTimes(0);
      expect(props.getTableList).toBeCalledTimes(0);
      expect(props.handleError).toBeCalledTimes(1);
      expect(props.onDbChange).toBeCalledTimes(0);
      expect(props.onSchemaChange).toBeCalledTimes(0);
      expect(props.onSchemasLoad).toBeCalledTimes(1);
      expect(props.onChange).toBeCalledTimes(0);

      fireEvent.click(screen.getByTestId('DatabaseSelect-onChange'));
      expect(props.getDbList).toBeCalledTimes(0);
      expect(props.getTableList).toBeCalledTimes(0);
      expect(props.handleError).toBeCalledTimes(1);
      expect(props.onDbChange).toBeCalledTimes(1);
      expect(props.onSchemaChange).toBeCalledTimes(1);
      expect(props.onSchemasLoad).toBeCalledTimes(1);
      expect(props.onChange).toBeCalledTimes(1);

      fireEvent.click(screen.getByTestId('DatabaseSelect-mutator'));
      expect(props.getTableList).toBeCalledTimes(0);
      expect(props.getDbList).toBeCalledTimes(1);
      expect(props.handleError).toBeCalledTimes(1);
      expect(props.onDbChange).toBeCalledTimes(1);
      expect(props.onSchemaChange).toBeCalledTimes(1);
      expect(props.onSchemasLoad).toBeCalledTimes(1);
      expect(props.onChange).toBeCalledTimes(1);
    });
  });

  describe('Should render SchemaSelect correctly', () => {
    describe('Should hasRefresh=!formMode && !readOnly', () => {
      it('formMode:false readOnly:false | hasRefresh:true', async () => {
        const props = { ...defaultProps, formMode: false, readOnly: false };
        await act(async () => {
          render(<DatabaseSelector {...props} />);
        });

        expect(screen.getByTestId('SchemaSelect')).toBeInTheDocument();
        expect(screen.getByTestId('SchemaSelect')).toHaveAttribute(
          'data-hasrefresh',
          'true',
        );
      });
      it('formMode:false readOnly:true | hasRefresh:false', async () => {
        const props = { ...defaultProps, formMode: false, readOnly: true };
        await act(async () => {
          render(<DatabaseSelector {...props} />);
        });

        expect(screen.getByTestId('SchemaSelect')).toBeInTheDocument();
        expect(screen.getByTestId('SchemaSelect')).toHaveAttribute(
          'data-hasrefresh',
          'false',
        );
      });
      it('formMode:true readOnly:false | hasRefresh:false', async () => {
        const props = { ...defaultProps, formMode: true, readOnly: false };
        await act(async () => {
          render(<DatabaseSelector {...props} />);
        });

        expect(screen.getByTestId('SchemaSelect')).toBeInTheDocument();
        expect(screen.getByTestId('SchemaSelect')).toHaveAttribute(
          'data-hasrefresh',
          'false',
        );
      });
      it('formMode:true readOnly:true | hasRefresh:false', async () => {
        const props = { ...defaultProps, formMode: true, readOnly: true };
        await act(async () => {
          render(<DatabaseSelector {...props} />);
        });

        expect(screen.getByTestId('SchemaSelect')).toBeInTheDocument();
        expect(screen.getByTestId('SchemaSelect')).toHaveAttribute(
          'data-hasrefresh',
          'false',
        );
      });
      it('formMode:undefined(false) readOnly:undefined(false) | hasRefresh:true', async () => {
        const props = {
          ...defaultProps,
          formMode: undefined,
          readOnly: undefined,
        };
        await act(async () => {
          render(<DatabaseSelector {...props} />);
        });

        expect(screen.getByTestId('SchemaSelect')).toBeInTheDocument();
        expect(screen.getByTestId('SchemaSelect')).toHaveAttribute(
          'data-hasrefresh',
          'true',
        );
      });
    });

    it('Should call props correctly', async () => {
      const props = {
        ...defaultProps,
        isDatabaseSelectEnabled: false,
        readOnly: false,
      };
      await act(async () => {
        render(<DatabaseSelector {...props} />);
      });

      [
        {
          key: 'data-schemaoptions',
          value:
            '[{"value":"information_schema","label":"information_schema","title":"information_schema"},{"value":"public","label":"public","title":"public"}]',
        },
        { key: 'data-currentschema', value: 'schema' },
        { key: 'data-loading', value: 'false' },
        { key: 'data-readonly', value: 'false' },
      ].forEach(attr => {
        expect(screen.getByTestId('SchemaSelect')).toHaveAttribute(
          attr.key,
          attr.value,
        );
      });

      expect(props.getDbList).toBeCalledTimes(0);
      expect(props.getTableList).toBeCalledTimes(0);
      expect(props.handleError).toBeCalledTimes(0);
      expect(props.onDbChange).toBeCalledTimes(0);
      expect(props.onSchemaChange).toBeCalledTimes(0);
      expect(props.onSchemasLoad).toBeCalledTimes(1);
      expect(props.onChange).toBeCalledTimes(0);

      fireEvent.click(screen.getByTestId('SchemaSelect-onChange'));
      expect(props.getDbList).toBeCalledTimes(0);
      expect(props.getTableList).toBeCalledTimes(1);
      expect(props.handleError).toBeCalledTimes(0);
      expect(props.onDbChange).toBeCalledTimes(0);
      expect(props.onSchemaChange).toBeCalledTimes(1);
      expect(props.onSchemasLoad).toBeCalledTimes(1);
      expect(props.onChange).toBeCalledTimes(1);

      await act(async () => {
        fireEvent.click(screen.getByTestId('SchemaSelect-refresh'));
      });
      expect(props.getDbList).toBeCalledTimes(0);
      expect(props.getTableList).toBeCalledTimes(1);
      expect(props.handleError).toBeCalledTimes(0);
      expect(props.onDbChange).toBeCalledTimes(1);
      expect(props.onSchemaChange).toBeCalledTimes(2);
      expect(props.onSchemasLoad).toBeCalledTimes(2);
      expect(props.onChange).toBeCalledTimes(2);
    });
  });
});
