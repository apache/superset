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
import { fireEvent, render } from '../../testing';
import { Button } from './index';

test('works with an onClick handler', () => {
  const mockAction = jest.fn();
  const { getByRole } = render(<Button onClick={mockAction} />);
  fireEvent.click(getByRole('button'));
  expect(mockAction).toHaveBeenCalled();
});

test('does not handle onClicks when disabled', () => {
  const mockAction = jest.fn();
  const { getByRole } = render(<Button onClick={mockAction} disabled />);
  fireEvent.click(getByRole('button'));
  expect(mockAction).toHaveBeenCalledTimes(0);
});

test('secondary button renders without errors', () => {
  const { getByRole } = render(
    <Button buttonStyle="secondary">Secondary</Button>,
  );
  expect(getByRole('button')).toBeInTheDocument();
});

test('styleConfig overrides theme defaults', () => {
  const { getByRole } = render(
    <Button
      buttonStyle="primary"
      styleConfig={{
        controlHeight: 50,
        fontSize: 20,
        fontWeight: 900,
        paddingInline: 30,
        borderRadius: 12,
      }}
    >
      Custom
    </Button>,
  );
  expect(getByRole('button')).toBeInTheDocument();
});

test('styleConfig partial override merges with defaults', () => {
  const { getByRole } = render(
    <Button buttonStyle="primary" styleConfig={{ controlHeight: 44 }}>
      Partial
    </Button>,
  );
  expect(getByRole('button')).toBeInTheDocument();
});

test('xsmall size resolves with theme tokens', () => {
  const { getByRole } = render(
    <Button buttonSize="xsmall" buttonStyle="primary">
      XSmall
    </Button>,
  );
  expect(getByRole('button')).toBeInTheDocument();
  expect(getByRole('button')).toHaveClass('superset-button');
});

test('small size resolves with theme tokens', () => {
  const { getByRole } = render(
    <Button buttonSize="small" buttonStyle="primary">
      Small
    </Button>,
  );
  expect(getByRole('button')).toBeInTheDocument();
  expect(getByRole('button')).toHaveClass('superset-button');
});

test('primary buttonStyle applies ant-btn-primary class', () => {
  const { getByRole } = render(<Button buttonStyle="primary">Primary</Button>);
  expect(getByRole('button')).toHaveClass('ant-btn-primary');
});

test('danger buttonStyle applies ant-btn-dangerous class', () => {
  const { getByRole } = render(<Button buttonStyle="danger">Danger</Button>);
  expect(getByRole('button')).toHaveClass('ant-btn-dangerous');
});

test('link buttonStyle applies ant-btn-link class', () => {
  const { getByRole } = render(<Button buttonStyle="link">Link</Button>);
  expect(getByRole('button')).toHaveClass('ant-btn-link');
});

test('secondary button merges consumer style with theme styles', () => {
  const { getByRole } = render(
    <Button buttonStyle="secondary" style={{ marginTop: 10, padding: 20 }}>
      Styled Secondary
    </Button>,
  );

  expect(getByRole('button')).toHaveStyle({
    marginTop: '10px',
    padding: '20px',
  });
});
