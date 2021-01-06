import {setFailed} from '@actions/core'
import {ActionError} from 'typings/ActionError'
/**
 * @function getErrorString
 * @param name name of error
 * @param status status code of error
 * @param from name of function that error is thrown from
 * @param message error message
 * @param error error object to stringify and attach
 */
export function getErrorString(
  name: string,
  status = 500,
  from: string,
  message: string,
  error: any = ''
): string {
  try {
    const test = JSON.stringify(
      {
        error: `${status}/${name}`,
        from,
        message,
        payload: error
      } as ActionError,
      null,
      2
    )
    return test
  } catch (error_) {
    setFailed(`Error throwing error.\n ${JSON.stringify(error_.message)}`)
    throw new Error(
      JSON.stringify({name: '500/undefined', message: 'Error throwing error.'})
    )
  }
}
/**
 * @function errorMessage
 * @param f name of function
 * @param e error object
 * @returns error message for function
 */
export function errorMessage(f: string, e: Error): string {
  const error = JSON.stringify(e, null, 2)
  let ret
  if (f.includes('getInputs')) ret = `There was an getting action inputs.`
  if (f.includes('inferInput'))
    ret = `There was an issue inferring inputs to the action.`
  if (f.includes('initClient'))
    ret = `There was an issue initilizing the github client.`
  if (f.includes('getChangedFiles'))
    ret = `There was an issue getting changed files from Github.`
  if (f.includes('sortChangedFiles'))
    ret = `There was an issue sorting changed files from Github.`
  if (f.includes('writeFiles')) ret = `There was an issue writing output files.`
  if (f.includes('writeOutput'))
    ret = `There was an issue writing output variables.`
  return `${ret}\nException: ${error}`
}
