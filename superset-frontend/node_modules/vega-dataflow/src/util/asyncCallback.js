/**
 * Invoke and await a potentially async callback function. If
 * an error occurs, trap it and route to Dataflow.error.
 * @param {Dataflow} df - The dataflow instance
 * @param {function} callback - A callback function to invoke
 *   and then await. The dataflow will be passed as the single
 *   argument to the function.
 */
export default async function(df, callback) {
  try { await callback(df); } catch (err) { df.error(err); }
}
