import {warning as coreWarning, getInput as coreGetInput} from '@actions/core'
import {context} from '@actions/github'
import {Inferred} from 'typings/Inferred'
import {Inputs} from 'typings/Inputs'
import {getErrorString} from './UtilsHelper'

/**
 * @function getInputs
 * @description reads the inputs to the action with core.getInput and returns object
 * @returns {Inputs} object of inputs for the github action
 */
export function getInputs(): Inputs {
  try {
    const githubToken =
      coreGetInput('githubToken') || process.env.GITHUB_TOKEN || false
    if (!githubToken)
      throw new Error(
        getErrorString(
          'getInputs Error',
          500,
          getInputs.name,
          'Received no token, a token is a requirement.'
        )
      )
    let prNumber
    if (typeof context.issue.number !== 'undefined') {
      if (
        +coreGetInput('prNumber') !== context.issue.number &&
        coreGetInput('prNumber')
      ) {
        prNumber = +coreGetInput('prNumber')
      } else {
        prNumber = context.issue.number
      }
    } else {
      prNumber = +coreGetInput('prNumber') || NaN
    }
    return {
      githubRepo:
        coreGetInput('githubRepo') ||
        `${context.repo.owner}/${context.repo.repo}`,
      githubToken,
      pushBefore:
        coreGetInput('pushBefore') ||
        (context.payload.before === undefined ? false : context.payload.before),
      pushAfter:
        coreGetInput('pushAfter') ||
        (context.payload.after === undefined ? false : context.payload.after),
      prNumber,
      output: coreGetInput('output') || ' ',
      fileOutput: coreGetInput('fileOutput') || ' ',
      event: context.eventName
    } as Inputs
  } catch (error) {
    const eString = `Received an issue getting action inputs.`
    const retVars = Object.fromEntries(
      Object.entries(process.env).filter(
        key =>
          key[0].includes('GITHUB') ||
          key[0].includes('INPUT_') ||
          key[0] === 'HOME'
      )
    )
    throw new Error(
      getErrorString('getInputs Error', 500, getInputs.name, eString, retVars)
    )
  }
}
/**
 * @function inferInput
 * @param before BASE commit sha to compare
 * @param after HEAD commit sha to compare
 * @param pr pr number to get changed files for
 * @returns {Inferred} object of inferred input for the action
 */
export function inferInput(
  before: string,
  after: string,
  pr: number
): Inferred {
  const event = context.eventName
  const weirdInput = `Received event from ${event}, but also received a before(${before}) or after(${after}) value.\n I am assuming you want to use a Push event but forgot something, so I'm giving you a message.`
  const allInput = `Received event from ${event}, but received a before(${before}), after(${after}), and PR(${pr}).\n I am assuming you want to use one or the other but I am giving you Push.`
  if (event === 'pull_request') {
    if (
      before &&
      after &&
      (before !== context.payload.before || after !== context.payload.after)
    )
      return {before, after} // PR(push) - pull_request event with push inputs | PUSH
    if (before || after) coreWarning(weirdInput) // PR(push) - pull_request event with single push input | PR*
    return {pr} // PR - pull_request event with no push inputs | PR
  }
  if (event === 'push') {
    if (pr) return {pr} // Push(PR) - push event with pr inputs | PR
    return {before, after} // Push - push event with no pr inputs | PUSH
  }
  if (pr) {
    if (before && after) {
      coreWarning(allInput) // Not PR or Push - all inputs | PUSH*
      if (event === 'issue_comment') return {before, after} // If you explicitly set a before/after in an issue comment it will return those
      return {pr} // Not PR or Push - pr inputs | PR if a PR before and after assume its a synchronize and return the whole PR
    }
    if (before || after) coreWarning(weirdInput) // Not PR or Push - pull_request event with single push input | PR*
    return {pr} // Not PR or Push - pr inputs | PR
  }
  if (before || after) {
    if (!(before && after)) {
      const eString = `Received event from ${event}, but only received a before(${before}) or after(${after}).\n I need both of these if you want to use a Push event.`
      throw new Error(
        getErrorString('inferInput Error', 500, inferInput.name, eString)
      )
    }
    return {before, after} // Not PR or Push - push inputs | PUSH
  }
  const eString = `Received event from ${event}, but received no inputs. {event_name:${event}, pr: ${+pr}, before:${before}, after:${after}}`
  throw new Error(
    getErrorString('inferInput Error', 500, inferInput.name, eString)
  )
}
