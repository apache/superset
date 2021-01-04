// Imports
import {Inferred} from 'typings/Inferred'
import {TestInput} from 'typings/TestInput'
import * as p from './mocks/octokit/payloads'

/**
 * Events to Test
 */
export const testEvents: string[] = [
  'issue_comment_created',
  'issue_comment_edited',
  'pull_request_opened',
  'pull_request_reopened',
  'pull_request_synchronize',
  'push_merge',
  'push',
  'schedule'
]

export function changedFilesInput(
  event = 'pull',
  files: string[] = p.normalFileArray,
  formats: string[] = ['json', ',', ' ', '_<br />&nbsp;&nbsp;_']
): TestInput[] {
  return formats.map(format => {
    if (format === 'json')
      return {
        inputs: [format, files, JSON.stringify(files)],
        events: event
      } as TestInput
    return {
      inputs: [format, files, files.join(format)],
      events: event
    } as TestInput
  })
}
/**
 * FilesHelper Test inputs
 */
export const getFormatExtInputs: TestInput[] = [
  {inputs: ['json', 'json', '.json'], events: 'push'},
  {inputs: ['csv', ',', '.csv'], events: 'push'},
  {inputs: ['txt', ' ', '.txt'], events: 'push'},
  {inputs: ['txt_hard', '_<br />&nbsp;&nbsp;_', '.txt'], events: 'push'}
]
/**
 * GithubHelper Test inputs
 */
export const initClientTestInputs: TestInput[] = [
  {
    inputs: [
      'calls the Github client constructor with a token',
      '12345abcde',
      '12345abcde'
    ],
    events: 'all'
  },
  {
    inputs: ['calls the Github client constructor without a token', '', ''],
    events: 'all'
  }
]
export const getChangedPRFilesTestInputs: TestInput[] = [
  {
    inputs: [
      'gets changed files for a pull request',
      {owner: 'trilom', repo: 'file-changes-action', pullNumber: 83},
      p.OctokitPaginatePrResponse
    ],
    events: 'all'
  },
  {
    inputs: [
      'throws an error with no pull request',
      {owner: 'trilom', repo: 'file-changes-action', pullNumber: NaN},
      {
        error: '404/HttpError',
        from: 'getChangedPRFiles',
        message:
          'There was an error getting change files for repo:file-changes-action owner:trilom pr:NaN',
        payload: {name: 'HttpError', status: '404'}
      }
    ],
    events: 'all'
  },
  {
    inputs: [
      'throws an error with invalid repo for pull request',
      {
        owner: 'trilom',
        repo: 'file-chandkdk-action-thatdoesntreallyexist',
        pullNumber: 83
      },
      {
        error: '404/HttpError',
        from: 'getChangedPRFiles',
        message:
          'There was an error getting change files for repo:file-chandkdk-action-thatdoesntreallyexist owner:trilom pr:83',
        payload: {name: 'HttpError', status: '404'}
      }
    ],
    events: 'all'
  },
  {
    inputs: [
      'throws an error with invalid owner for pull request',
      {
        owner: 'this-isntareal-githubowner',
        repo: 'file-changes-action',
        pullNumber: 83
      },
      {
        error: '404/HttpError',
        from: 'getChangedPRFiles',
        message:
          'There was an error getting change files for repo:file-changes-action owner:this-isntareal-githubowner pr:83',
        payload: {name: 'HttpError', status: '404'}
      }
    ],
    events: 'all'
  }
]
export const getChangedPushFilesTestInputs: TestInput[] = [
  {
    inputs: [
      'gets changed files for a push',
      {
        owner: 'trilom',
        repo: 'file-changes-action',
        before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
        after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968'
      },
      p.OctokitPaginatePushResponse
    ],
    events: 'all'
  },
  {
    inputs: [
      'throws an error with no before for a push',
      {
        owner: 'trilom',
        repo: 'file-changes-action',
        before: '',
        after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968'
      },
      {
        error: '404/HttpError',
        from: 'getChangedPushFiles',
        message:
          'There was an error getting change files for repo:file-changes-action owner:trilom base: head:4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968',
        payload: {name: 'HttpError', status: '404'}
      }
    ],
    events: 'all'
  },
  {
    inputs: [
      'throws an error with no after for a push',
      {
        owner: 'trilom',
        repo: 'file-changes-action',
        before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
        after: ''
      },
      {
        error: '404/HttpError',
        from: 'getChangedPushFiles',
        message:
          'There was an error getting change files for repo:file-changes-action owner:trilom base:6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2 head:',
        payload: {name: 'HttpError', status: '404'}
      }
    ],
    events: 'all'
  },
  {
    inputs: [
      'throws an error with invalid repo for a push',
      {
        owner: 'trilom',
        repo: 'file-chandkdk-action-thatdoesntreallyexist',
        before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
        after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968'
      },
      {
        error: '404/HttpError',
        from: 'getChangedPushFiles',
        message:
          'There was an error getting change files for repo:file-chandkdk-action-thatdoesntreallyexist owner:trilom base:6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2 head:4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968',
        payload: {name: 'HttpError', status: '404'}
      }
    ],
    events: 'all'
  },
  {
    inputs: [
      'throws an error with invalid owner for a push',
      {
        owner: 'this-isntareal-githubowner',
        repo: 'file-changes-action',
        before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
        after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968'
      },
      {
        error: '404/HttpError',
        from: 'getChangedPushFiles',
        message:
          'There was an error getting change files for repo:file-changes-action owner:this-isntareal-githubowner base:6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2 head:4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968',
        payload: {name: 'HttpError', status: '404'}
      }
    ],
    events: 'all'
  }
]
export const getChangedFilesTestInputs: TestInput[] = [
  {
    inputs: [
      'gets changed files for a push',
      {
        repo: 'trilom/file-changes-action',
        ...({
          before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
          after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968'
        } as Inferred)
      },
      p.OctokitPaginatePushResponse
    ],
    events: 'all'
  },
  {
    inputs: [
      'throws an error with a malformed owner/repo for a push',
      {
        repo: 'trilom/testing/afew/backslash',
        ...({
          before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
          after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968'
        } as Inferred)
      },
      {
        error: '500/Unknown Error:Error',
        from: 'getChangedFiles',
        message:
          'There was an error getting change files outputs pr: NaN before: 6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2 after: 4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968',
        payload: JSON.stringify(
          {
            error: '500/Bad-Repo',
            from: 'self',
            message:
              'Repo input of trilom/testing/afew/backslash has more than 2 length after splitting.',
            payload: ''
          },
          null,
          2
        )
      }
    ],
    events: 'all'
  },
  {
    inputs: [
      'throws an error with invalid owner for a push',
      {
        repo: 'trilom-NOTREAL/backslash',
        ...({
          before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
          after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968'
        } as Inferred)
      },
      {
        error: '404/HttpError',
        from: 'undefined/Error',
        message:
          'There was an error getting change files for repo:backslash owner:trilom-NOTREAL base:6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2 head:4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968',
        payload: {name: 'HttpError', status: '404'}
      }
    ],
    events: 'all'
  },
  {
    inputs: [
      'throws an error with no after for a push',
      {
        repo: 'trilom/cloudformation',
        ...({before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2'} as Inferred)
      },
      {
        error: '404/HttpError',
        from: 'undefined/Error',
        message:
          'There was an error getting change files for repo:cloudformation owner:trilom base:6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2 head:',
        payload: {name: 'HttpError', status: '404'}
      }
    ],
    events: 'all'
  },
  {
    inputs: [
      'throws an error with no before for a push',
      {
        repo: 'trilom/cloudformation',
        ...({after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968'} as Inferred)
      },
      {
        error: '404/HttpError',
        from: 'undefined/Error',
        message:
          'There was an error getting change files for repo:cloudformation owner:trilom base: head:4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968',
        payload: {name: 'HttpError', status: '404'}
      }
    ],
    events: 'all'
  },
  {
    inputs: [
      'gets changed files for a pull request',
      {repo: 'trilom/file-changes-action', ...({pr: 83} as Inferred)},
      p.OctokitPaginatePrResponse
    ],
    events: 'all'
  },
  {
    inputs: [
      'throws an error with a malformed owner/repo for a pr',
      {repo: 'trilom/testing/afew/backslash', ...({pr: 83} as Inferred)},
      {
        error: '500/Unknown Error:Error',
        from: 'getChangedFiles',
        message:
          'There was an error getting change files outputs pr: 83 before: undefined after: undefined',
        payload: JSON.stringify(
          {
            error: '500/Bad-Repo',
            from: 'self',
            message:
              'Repo input of trilom/testing/afew/backslash has more than 2 length after splitting.',
            payload: ''
          },
          null,
          2
        )
      }
    ],
    events: 'all'
  },
  {
    inputs: [
      'throws an error with invalid owner for a pr',
      {repo: 'trilom-NOTREAL/backslash', ...({pr: 80} as Inferred)},
      {
        error: '404/HttpError',
        from: 'undefined/Error',
        message:
          'There was an error getting change files for repo:backslash owner:trilom-NOTREAL pr:80',
        payload: {name: 'HttpError', status: '404'}
      }
    ],
    events: 'all'
  },
  {
    inputs: [
      'throws an error with no pull request',
      {repo: 'trilom/cloudformation', ...({} as Inferred)},
      {
        error: '404/HttpError',
        from: 'undefined/Error',
        message:
          'There was an error getting change files for repo:cloudformation owner:trilom base: head:',
        payload: {name: 'HttpError', status: '404'}
      }
    ],
    events: 'all'
  },
  {
    inputs: [
      'throws an error with no pull request',
      {repo: 'trilom/cloudformation', ...({} as Inferred)},
      {
        error: '404/HttpError',
        from: 'undefined/Error',
        message:
          'There was an error getting change files for repo:cloudformation owner:trilom base: head:',
        payload: {name: 'HttpError', status: '404'}
      }
    ],
    events: 'all'
  }
]
/**
 * InputHelper Test inputs
 */
export const inputTestInputs: TestInput[] = [
  {
    inputs: [
      'githubRepo',
      'trilom-test/file-changes-action',
      'trilom-test/file-changes-action'
    ],
    events: 'all'
  },
  {inputs: ['githubToken', 'InputTestToken', 'InputTestToken'], events: 'all'},
  {
    inputs: [
      'pushBefore',
      '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
      '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2'
    ],
    events: 'all'
  },
  {
    inputs: [
      'pushAfter',
      '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968',
      '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968'
    ],
    events: 'all'
  },
  {inputs: ['prNumber', '83', 83], events: 'all'},
  {inputs: ['output', 'json', 'json'], events: 'all'},
  {inputs: ['fileOutput', 'json', 'json'], events: 'all'}
]
export const inferTestInputs: TestInput[] = [
  {
    inputs: [
      'sets PUSH inferred outputs with pr inputs and PUSH inputs and PULL_REQUEST event',
      {
        event: 'pull_request',
        before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
        after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968',
        pr: 83
      },
      {
        before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
        after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968'
      } as Inferred
    ],
    events: ['pull_request_opened', 'pull_request_reopened']
  },
  {
    inputs: [
      'sets PR inferred outputs with pr inputs and PUSH inputs and PULL_REQUEST_SYNCHRONIZE event',
      {
        event: 'pull_request',
        before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
        after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968',
        pr: 83
      },
      {
        before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
        after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968'
      } as Inferred
    ],
    events: ['pull_request_synchronize']
  },
  {
    inputs: [
      'sets PULL_REQUEST inferred outputs with single PUSH input and PULL_REQUEST event, ALSO WARN weird',
      {
        event: 'pull_request',
        before: '787a72d40923de2f5308e7095ff9e6063fdbc219',
        after: '',
        pr: 83
      },
      {pr: 83} as Inferred
    ],
    events: [
      'pull_request_opened',
      'pull_request_reopened',
      'pull_request_synchronize'
    ]
  },
  {
    inputs: [
      'sets PULL_REQUEST inferred outputs with no PUSH inputs and PULL_REQUEST event',
      {event: 'pull_request', before: '', after: '', pr: 83},
      {pr: 83} as Inferred
    ],
    events: [
      'pull_request_opened',
      'pull_request_reopened',
      'pull_request_synchronize'
    ]
  },
  {
    inputs: [
      'sets PULL_REQUEST inferred outputs with pr input and PUSH event',
      {
        event: 'push',
        before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
        after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968',
        pr: 83
      },
      {pr: 83} as Inferred
    ],
    events: ['push', 'push_merge']
  },
  {
    inputs: [
      'sets PUSH inferred outputs with no pr input and PUSH event',
      {
        event: 'push',
        before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
        after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968',
        pr: NaN
      },
      {
        before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
        after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968'
      } as Inferred
    ],
    events: ['push', 'push_merge']
  },
  {
    inputs: [
      'sets PUSH inferred outputs with PUSH and PULL_REQUEST inputs NOT PUSH or PULL_REQUEST event, ALSO WARN all',
      {
        event: 'schedule',
        before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
        after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968',
        pr: 83
      },
      {
        before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
        after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968'
      } as Inferred
    ],
    events: ['issue_comment_created', 'issue_comment_edited']
  },
  {
    inputs: [
      'sets PUSH inferred outputs with PUSH and PULL_REQUEST inputs NOT PUSH or PULL_REQUEST event, ALSO WARN all',
      {
        event: 'schedule',
        before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
        after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968',
        pr: 83
      },
      {pr: 83} as Inferred
    ],
    events: ['schedule']
  },
  {
    inputs: [
      'sets PULL_REQUEST inferred outputs with single PUSH and PULL_REQUEST inputs NOT PUSH or PULL_REQUEST event, ALSO WARN weird',
      {
        event: 'schedule',
        before: '',
        after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968',
        pr: 83
      },
      {pr: 83} as Inferred
    ],
    events: ['issue_comment_created', 'issue_comment_edited', 'schedule']
  },
  {
    inputs: [
      'sets PULL_REQUEST inferred outputs with PULL_REQUEST input NOT PUSH or PULL_REQUEST event',
      {event: 'schedule', before: '', after: '', pr: 83},
      {pr: 83} as Inferred
    ],
    events: ['issue_comment_created', 'issue_comment_edited', 'schedule']
  },
  {
    inputs: [
      'sets PUSH inferred outputs with PUSH inputs NOT PUSH or PULL_REQUEST event',
      {
        event: 'schedule',
        before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
        after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968',
        pr: NaN
      },
      {
        before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
        after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968'
      } as Inferred
    ],
    events: ['issue_comment_created', 'issue_comment_edited', 'schedule']
  },
  {
    inputs: [
      'throws ERROR with no inputs NOT PUSH or PULL_REQUEST event',
      {before: '', after: '', pr: NaN},
      {} as Inferred
    ],
    events: ['issue_comment_created', 'issue_comment_edited', 'schedule']
  },
  {
    inputs: [
      'throws ERROR with single only before NOT PUSH or PULL_REQUEST event',
      {before: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2', pr: NaN},
      {} as Inferred
    ],
    events: ['issue_comment_created', 'issue_comment_edited', 'schedule']
  },
  {
    inputs: [
      'throws ERROR with single only after NOT PUSH or PULL_REQUEST event',
      {after: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968', pr: NaN},
      {} as Inferred
    ],
    events: ['issue_comment_created', 'issue_comment_edited', 'schedule']
  }
]
/**
 * UtilsHelper Test inputs
 */
export const errorMessageInputs: TestInput[] = [
  {
    inputs: [
      'getInputs',
      JSON.stringify(
        {name: 'Error', message: 'Error', from: 'getInputs'},
        null,
        2
      ),
      'There was an getting action inputs.'
    ],
    events: 'all'
  },
  {
    inputs: [
      'inferInput',
      JSON.stringify(
        {name: 'Error', message: 'Error', from: 'inferInput'},
        null,
        2
      ),
      'There was an issue inferring inputs to the action.'
    ],
    events: 'all'
  },
  {
    inputs: [
      'initClient',
      JSON.stringify(
        {name: 'Error', message: 'Error', from: 'initClient'},
        null,
        2
      ),
      'There was an issue initilizing the github client.'
    ],
    events: 'all'
  },
  {
    inputs: [
      'getChangedFiles',
      JSON.stringify(
        {name: 'Error', message: 'Error', from: 'getChangedFiles'},
        null,
        2
      ),
      'There was an issue getting changed files from Github.'
    ],
    events: 'all'
  },
  {
    inputs: [
      'sortChangedFiles',
      JSON.stringify(
        {name: 'Error', message: 'Error', from: 'sortChangedFiles'},
        null,
        2
      ),
      'There was an issue sorting changed files from Github.'
    ],
    events: 'all'
  },
  {
    inputs: [
      'writeFiles',
      JSON.stringify(
        {name: 'Error', message: 'Error', from: 'writeFiles'},
        null,
        2
      ),
      'There was an issue writing output files.'
    ],
    events: 'all'
  },
  {
    inputs: [
      'writeOutput',
      JSON.stringify(
        {name: 'Error', message: 'Error', from: 'writeOutput'},
        null,
        2
      ),
      'There was an issue writing output variables.'
    ],
    events: 'all'
  }
]
/**
 * main Test inputs
 */
export const mainInputs: TestInput[] = [
  {
    inputs: [
      'push',
      {
        pushBefore: '6ac7697cd1c4f23a08d4d4edbe7dab06b34c58a2',
        pushAfter: '4ee1a1a2515f4ac1b90a56aaeb060b97f20c8968'
      },
      'push'
    ],
    events: 'all'
  },
  {inputs: ['pull_request', {prNumber: '83'}, 'pull_request'], events: 'all'}
]
export {errorMessageInputs as mainErrorInputs}
