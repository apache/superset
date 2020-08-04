import {ImputeSequence} from './transform';
import {ImputeMethod} from 'vega';

export interface ImputeParams {
  /**
   * The imputation method to use for the field value of imputed data objects.
   * One of `"value"`, `"mean"`, `"median"`, `"max"` or `"min"`.
   *
   * __Default value:__  `"value"`
   */
  method?: ImputeMethod;

  /**
   * The field value to use when the imputation `method` is `"value"`.
   */
  value?: any;

  /**
   * Defines the key values that should be considered for imputation.
   * An array of key values or an object defining a [number sequence](https://vega.github.io/vega-lite/docs/impute.html#sequence-def).
   *
   * If provided, this will be used in addition to the key values observed within the input data. If not provided, the values will be derived from all unique values of the `key` field. For `impute` in `encoding`, the key field is the x-field if the y-field is imputed, or vice versa.
   *
   * If there is no impute grouping, this property _must_ be specified.
   */
  keyvals?: any[] | ImputeSequence;

  /**
   * A frame specification as a two-element array used to control the window over which the specified method is applied. The array entries should either be a number indicating the offset from the current data object, or null to indicate unbounded rows preceding or following the current data object. For example, the value `[-5, 5]` indicates that the window should include five objects preceding and five objects following the current object.
   *
   * __Default value:__:  `[null, null]` indicating that the window includes all objects.
   */
  frame?: [null | number, null | number];
}
