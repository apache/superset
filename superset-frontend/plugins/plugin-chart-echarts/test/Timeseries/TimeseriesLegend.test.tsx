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
import { render, screen } from "../../../../spec/helpers/testing-library";
import TimeseriesLegend from "../../src/Timeseries/TimeseriesLegend";

const baseItems = [
  { color: "#ff0000", interactive: true, name: "Alpha", selected: true },
  { color: "#00ff00", interactive: true, name: "Beta", selected: false },
];

const baseProps = {
  items: baseItems,
  maxHeight: 200,
  onAll: jest.fn(),
  onHover: jest.fn(),
  onInverse: jest.fn(),
  onToggle: jest.fn(),
  showSelectors: false,
};

test("renders items for a top-oriented legend", () => {
  render(<TimeseriesLegend {...baseProps} orientation="top" />);
  expect(screen.getByTestId("timeseries-custom-legend")).toBeInTheDocument();
  expect(screen.getByText("Alpha")).toBeInTheDocument();
  expect(screen.getByText("Beta")).toBeInTheDocument();
});

test("renders items for a left-oriented vertical legend", () => {
  render(<TimeseriesLegend {...baseProps} orientation="left" maxWidth={200} />);
  expect(screen.getByTestId("timeseries-custom-legend")).toBeInTheDocument();
  expect(screen.getByText("Alpha")).toBeInTheDocument();
});

test("renders items for a right-oriented vertical legend", () => {
  render(
    <TimeseriesLegend {...baseProps} orientation="right" maxWidth={200} />,
  );
  expect(screen.getByTestId("timeseries-custom-legend")).toBeInTheDocument();
  expect(screen.getByText("Alpha")).toBeInTheDocument();
});

test("returns null when maxWidth is 0 for a vertical legend (noSpace guard)", () => {
  const { container } = render(
    <TimeseriesLegend {...baseProps} orientation="left" maxWidth={0} />,
  );
  expect(container.firstChild).toBeNull();
});

test("returns null when items list is empty", () => {
  const { container } = render(
    <TimeseriesLegend {...baseProps} items={[]} orientation="top" />,
  );
  expect(container.firstChild).toBeNull();
});

test("adds title attribute on labels for vertical (left) orientation", () => {
  render(<TimeseriesLegend {...baseProps} orientation="left" maxWidth={200} />);
  // Labels in vertical mode should have a title for hover readability
  const alphaLabel = screen.getByText("Alpha");
  expect(alphaLabel).toHaveAttribute("title", "Alpha");
});

test("omits title attribute on labels for horizontal (top) orientation", () => {
  render(<TimeseriesLegend {...baseProps} orientation="top" />);
  const alphaLabel = screen.getByText("Alpha");
  expect(alphaLabel).not.toHaveAttribute("title");
});
