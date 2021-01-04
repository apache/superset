import {setOutput as coreSetOutput, debug as coreDebug} from '@actions/core'
import {writeFileSync} from 'fs'
import {ChangedFiles} from 'typings/ChangedFiles'
import {GitHubFile} from 'typings/GitHubFile'
import {getErrorString} from './UtilsHelper'

/**
 * @function sortChangedFiles
 * @param files pass in array of GithubFile's to be sorted
 * @returns ChangedFiles object that has .files, .added, .modified, .renamed, and .removed
 */
export function sortChangedFiles(files: GitHubFile[]): ChangedFiles {
  try {
    coreDebug(
      `Here are the files I am changing: ${JSON.stringify(files, null, 2)}`
    )
    const changedFiles = {
      files: [],
      added: [],
      removed: [],
      renamed: [],
      modified: []
    } as ChangedFiles
    files.forEach(f => {
      changedFiles[f.status].push(
        f.filename || f.added || f.removed || f.renamed || f.modified
      )
      changedFiles.files.push(
        f.filename || f.added || f.removed || f.modified || f.renamed
      )
    })
    return changedFiles
  } catch (error) {
    const eString = `There was an issue sorting files changed.`
    throw new Error(
      getErrorString(
        error.name,
        error.status,
        sortChangedFiles.name,
        eString,
        JSON.stringify(error)
      )
    )
  }
}

/**
 * @function getFormatExt
 * @param format output format 'json' = '.json' ',' = '.csv' anything else is '.txt'.
 * @returns file extension, '.json', '.csv', or '.txt'
 */
export function getFormatExt(format: string): string {
  let ext
  switch (format.trim()) {
    case 'json':
      ext = '.json'
      break
    case ',':
      ext = '.csv'
      break
    default:
      ext = '.txt'
      break
  }
  return ext
}

/**
 * @function formatChangedFiles
 * @param format output format 'json' will stringify anything else will files.join('string')
 * @param files string list of files to format
 * @returns string for output of changedFiles
 */
export function formatChangedFiles(format: string, files: string[]): string {
  if (format === 'json') {
    return JSON.stringify(files)
  }
  return files.join(format)
}

/**
 * @function writeFiles
 * @param format output format 'json' will stringify anything else will files.join('string')
 * @param key changedFiles type added, modified, removed, or files
 * @param files string list of files to format
 * @returns string output to be stored in file
 */
export function writeFiles(format: string, key: string, files: string[]): void {
  try {
    const ext = getFormatExt(format)
    const fileName = key === 'files' ? `${key}${ext}` : `files_${key}${ext}`
    coreDebug(
      `Writing output file ${
        process.env.HOME
      }/${fileName} with ${format} and files ${JSON.stringify(files, null, 2)}`
    )
    writeFileSync(
      `${process.env.HOME}/${fileName}`,
      formatChangedFiles(format, files),
      'utf-8'
    )
  } catch (error) {
    const eString = `There was an issue writing output files.`
    throw new Error(
      getErrorString(
        error.name,
        error.status,
        writeFiles.name,
        eString,
        JSON.stringify(error)
      )
    )
  }
}

/**
 * @function writeOutput
 * @param format output format 'json' will stringify anything else will files.join('string')
 * @param key changedFiles type added, modified, removed, or files
 * @param files string list of files to format
 * @returns string output to be stored to action output
 */
export function writeOutput(
  format: string,
  key: string,
  files: string[]
): void {
  try {
    const fileName = key === 'files' ? key : `files_${key}`
    coreDebug(
      `Writing output ${fileName} with ${format} and files ${JSON.stringify(
        files,
        null,
        2
      )}`
    )
    coreSetOutput(fileName, formatChangedFiles(format, files))
  } catch (error) {
    const eString = `There was an issue setting action outputs.`
    throw new Error(
      getErrorString(
        error.name,
        error.status,
        writeOutput.name,
        eString,
        JSON.stringify(error)
      )
    )
  }
}
