/*
 * Constants and utilities for data.
 */
import {VgData} from './vega.schema';
import {FieldName} from './channeldef';
import {Vector2} from 'vega';

export type ParseValue = null | string | 'string' | 'boolean' | 'date' | 'number';

export interface Parse {
  [field: string]: ParseValue;
}

export interface DataFormatBase {
  /**
   * If set to `null`, disable type inference based on the spec and only use type inference based on the data.
   * Alternatively, a parsing directive object can be provided for explicit data types. Each property of the object corresponds to a field name, and the value to the desired data type (one of `"number"`, `"boolean"`, `"date"`, or null (do not parse the field)).
   * For example, `"parse": {"modified_on": "date"}` parses the `modified_on` field in each input record a Date value.
   *
   * For `"date"`, we parse data based using Javascript's [`Date.parse()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse).
   * For Specific date formats can be provided (e.g., `{foo: "date:'%m%d%Y'"}`), using the [d3-time-format syntax](https://github.com/d3/d3-time-format#locale_format). UTC date format parsing is supported similarly (e.g., `{foo: "utc:'%m%d%Y'"}`). See more about [UTC time](https://vega.github.io/vega-lite/docs/timeunit.html#utc)
   */
  parse?: Parse | null;

  /**
   * Type of input data: `"json"`, `"csv"`, `"tsv"`, `"dsv"`.
   *
   * __Default value:__  The default format type is determined by the extension of the file URL.
   * If no extension is detected, `"json"` will be used by default.
   */
  type?: 'csv' | 'tsv' | 'dsv' | 'json' | 'topojson';
}

export interface CsvDataFormat extends DataFormatBase {
  type?: 'csv' | 'tsv';
}

export interface DsvDataFormat extends DataFormatBase {
  type?: 'dsv';

  /**
   * The delimiter between records. The delimiter must be a single character (i.e., a single 16-bit code unit); so, ASCII delimiters are fine, but emoji delimiters are not.
   *
   * @minLength 1
   * @maxLength 1
   */
  delimiter: string;
}

export interface JsonDataFormat extends DataFormatBase {
  type?: 'json';
  /**
   * The JSON property containing the desired data.
   * This parameter can be used when the loaded JSON file may have surrounding structure or meta-data.
   * For example `"property": "values.features"` is equivalent to retrieving `json.values.features`
   * from the loaded JSON object.
   */
  property?: string;
}

export interface TopoDataFormat extends DataFormatBase {
  type?: 'topojson';
  /**
   * The name of the TopoJSON object set to convert to a GeoJSON feature collection.
   * For example, in a map of the world, there may be an object set named `"countries"`.
   * Using the feature property, we can extract this set and generate a GeoJSON feature object for each country.
   */
  feature?: string;
  /**
   * The name of the TopoJSON object set to convert to mesh.
   * Similar to the `feature` option, `mesh` extracts a named TopoJSON object set.
   *  Unlike the `feature` option, the corresponding geo data is returned as a single, unified mesh instance, not as individual GeoJSON features.
   * Extracting a mesh is useful for more efficiently drawing borders or other geographic elements that you do not need to associate with specific regions such as individual countries, states or counties.
   */
  mesh?: string;
}

export type DataFormat = CsvDataFormat | DsvDataFormat | JsonDataFormat | TopoDataFormat;

export type DataFormatType = 'json' | 'csv' | 'tsv' | 'dsv' | 'topojson';

export type DataSource = UrlData | InlineData | NamedData;

export type Data = DataSource | Generator;

export type InlineDataset = number[] | string[] | boolean[] | object[] | string | object;

export interface DataBase {
  /**
   * An object that specifies the format for parsing the data.
   */
  format?: DataFormat;
  /**
   * Provide a placeholder name and bind data at runtime.
   */
  name?: string;
}

export interface UrlData extends DataBase {
  /**
   * An URL from which to load the data set. Use the `format.type` property
   * to ensure the loaded data is correctly parsed.
   */
  url: string;
}

export interface InlineData extends DataBase {
  /**
   * The full data set, included inline. This can be an array of objects or primitive values, an object, or a string.
   * Arrays of primitive values are ingested as objects with a `data` property. Strings are parsed according to the specified format type.
   */
  values: InlineDataset;
}

export interface NamedData extends DataBase {
  /**
   * Provide a placeholder name and bind data at runtime.
   */
  name: string;
}

export function isUrlData(data: Partial<Data> | Partial<VgData>): data is UrlData {
  return !!data['url'];
}

export function isInlineData(data: Partial<Data> | Partial<VgData>): data is InlineData {
  return !!data['values'];
}

export function isNamedData(data: Partial<Data> | Partial<VgData>): data is NamedData {
  return !!data['name'] && !isUrlData(data) && !isInlineData(data) && !isGenerator(data);
}

export function isGenerator(data: Partial<Data> | Partial<VgData>): data is Generator {
  return data && (isSequenceGenerator(data) || isSphereGenerator(data) || isGraticuleGenerator(data));
}

export function isSequenceGenerator(data: Partial<Data> | Partial<VgData>): data is SequenceGenerator {
  return !!data['sequence'];
}

export function isSphereGenerator(data: Partial<Data> | Partial<VgData>): data is SphereGenerator {
  return !!data['sphere'];
}

export function isGraticuleGenerator(data: Partial<Data> | Partial<VgData>): data is GraticuleGenerator {
  return !!data['graticule'];
}

export type DataSourceType = 'raw' | 'main' | 'row' | 'column' | 'lookup';

export const MAIN: 'main' = 'main';
export const RAW: 'raw' = 'raw';

export type Generator = SequenceGenerator | SphereGenerator | GraticuleGenerator;

export interface GeneratorBase {
  /**
   * Provide a placeholder name and bind data at runtime.
   */
  name?: string;
}

export interface SequenceGenerator extends GeneratorBase {
  /**
   * Generate a sequence of numbers.
   */
  sequence: SequenceParams;
}

export interface SequenceParams {
  /**
   * The starting value of the sequence (inclusive).
   */
  start: number;
  /**
   * The ending value of the sequence (exclusive).
   */
  stop: number;
  /**
   * The step value between sequence entries.
   *
   * __Default value:__ `1`
   */
  step?: number;

  /**
   * The name of the generated sequence field.
   *
   * __Default value:__ `"data"`
   */
  as?: FieldName;
}

export interface SphereGenerator extends GeneratorBase {
  /**
   * Generate sphere GeoJSON data for the full globe.
   */
  sphere: true | {};
}

export interface GraticuleGenerator extends GeneratorBase {
  /**
   * Generate graticule GeoJSON data for geographic reference lines.
   */
  graticule: true | GraticuleParams;
}

export interface GraticuleParams {
  /**
   * The major extent of the graticule as a two-element array of coordinates.
   */
  extentMajor?: Vector2<Vector2<number>>;

  /**
   * The minor extent of the graticule as a two-element array of coordinates.
   */
  extentMinor?: Vector2<Vector2<number>>;

  /**
   * Sets both the major and minor extents to the same values.
   */
  extent?: Vector2<Vector2<number>>;

  /**
   * The major step angles of the graticule.
   *
   *
   * __Default value:__ `[90, 360]`
   */
  stepMajor?: Vector2<number>;

  /**
   * The minor step angles of the graticule.
   *
   * __Default value:__ `[10, 10]`
   */
  stepMinor?: Vector2<number>;

  /**
   * Sets both the major and minor step angles to the same values.
   */
  step?: Vector2<number>;

  /**
   * The precision of the graticule in degrees.
   *
   * __Default value:__ `2.5`
   */
  precision?: number;
}
