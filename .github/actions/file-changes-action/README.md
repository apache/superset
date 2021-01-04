# file-changes-action

[![codecov](https://codecov.io/gh/trilom/file-changes-action/branch/master/graph/badge.svg)](https://codecov.io/gh/trilom/file-changes-action)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
![Integration Tests](https://github.com/trilom/file-changes-action/workflows/Integration%20Tests/badge.svg)

# Like my work?  Hire me!
> Please reach out if you need something built!  

This action will take the information from the Push/Pull Request and output some variables and write files that will let you know what was changed, removed, or added.

## Inputs

### githubRepo

_Optional_  - `string` - the github repository you want to compare changes from, defaults to the github.repository.

### githubToken

_Optional_  - `string` - specific github token, github.token is used by default (Github Action Runner)

### output

_Optional_  - `string` - type of output for output variables, default is json.  Use ',' for comma separated values, or ' ' for space delimited values.  You can also create your own delimiter for example ' |FILE:' will output 'file1.yml |FILE:file2.yml |FILE:file3.yml'.

### fileOutput

_Optional_  - `string` - type of output for file output, default is json.  Use ',' for comma separated values, or ' ' for space delimited values.  You can also create your own delimiter for example `\ |FILE:` will output:

> file1.yml |FILE:file2.yml |FILE:file3.yml  

If you select json then the file format will be .json, if you select ',' then the file format will be .csv, anything else will output the files as .txt

### pushBefore

_Optional_  - `string` - pass in a specific sha to compare to as a before, required if using pushAfter. (push payload after github.payload.before)

### pushAfter

_Optional_  - `string` - pass in a specific sha to compare to as an after, required if using pushBefore. (push payload after github.payload.after)

### prNumber

_Optional_  - `string` - pass in a specific PR number to get file changes from.

## Outputs

### files

steps.file_changes.outputs.files - `string` - The names all new, updated, and removed files.  The output is dependant on the output input, default is a json string.

### files_added

steps.file_changes.outputs.files_added - `string` - The names of the newly created files.  The output is dependant on the output input, default is a json string.

### files_modified

steps.file_changes.outputs.files_modified - `string` - The names of the updated files.  The output is dependant on the output input, default is a json string.

### files_removed

steps.file_changes.outputs.files_removed - `string` - The names of the removed files.  The output is dependant on the output input, default is a json string.

## Example usage

```yaml
# bare minimal
name: changes
on: push
jobs:
  changes:
    runs-on: ubuntu-latest
    steps:
      - id: file_changes
        uses: trilom/file-changes-action@v1.2.3

### full
name: changes
on: [push, pull_request] # push or pull, or any event with custom pr number or before/after commit sha
jobs:
  changes:
    runs-on: ubuntu-latest
    steps:
      - id: file_changes
        uses: trilom/file-changes-action@v1.2.3
        with:
          # optional target repo
          githubRepo: trilom/file-changes-action
          # optional token
          githubToken: ${{ secrets.BOT_TOKEN }}
          # optional output format
          output: 'json'
          # optional fileoutput format
          fileOutput: 'csv'
          # optional push before SHA (need both before and after)
          pushBefore: 79eeec74aebc3deb0a2f6234c5ac13142e9224e5
          # optional push after SHA (need both before and after)
          pushAfter: 1c5a2bfde79e2c9cffb75b9a455391350fe69a40
          # optional PR number to compare
          prNumber: 36
```

## How to Use

In order to make those decisions we need to know what files have changed and that is where this action comes in.  In the example below we are checking out our repository code, and then running the `trilom/file-changes-action@v1` action.  The only thing you need to provide is a GITHUB_TOKEN so that Octokit can make it's API calls.

If a PR is made then it will look at all of the files included in the PR.
If a push is made then it will compare commits from the SHA `github.payload.before` to the SHA `github.payload.after` of the push.

After gathering this information it will output the files in 2 ways.  

- As an output variable, you can use this variable by using `steps.file_changes_outputs_files`, `steps.file_changes.outputs.files_modified`, `steps.file_changes.outputs.files_added`, `steps.file_changes.outputs.files_removed`.

- As a file on the container stored at `$HOME/files.json`, `$HOME/files_modified.json`, `$HOME/files_added.json`, `$HOME/files_removed.json`.  

- _NOTE:_ If you set a custom delimiter in output or fileOutput inputs then you will receive different files.  For example a delimiter of ',' will output at `$HOME/files.csv` instead of `$HOME/files.json`.  Likewise, anything other than 'json' or ',' delmiters will output `$HOME/files.txt` files instead of `$HOME/files.json` by default.

## Use Cases

I have a process where I have AWS Cloudformation templates stored in one directory that might be named PRODUCT-ROLE, and mappings for these templates that span the PRODUCT.  For example **mappings/wordpress.mappings.yml, templates/wordpress-database.yml, templates/wordpress-webserver.yml**, and some of the templates might use different Lambda functions defined in for example **functions/wordpress-webserver/**.

In the example below we have a workflow that on *push* to the develop branch we can perform some actions based on the files.  In my use case I look for changes on the develop branch of this repository for every push that happens.  When a push happens and a change is made to any of the paths below the workflow will trigger.  With this action you are able to know exactly which files changed so that you can make decisions later in your CI/CD.

In this case, if a **templates/*.yml** file is changed, then we want to update the Cloudformation stack.  We can also write specifics for related templates.  For example, if **templates/wordpress-database.yml** changes then we want to deploy **templates/wordpress-webserver.yml** as well after.

Another case is if the **mappings/wordpress.mappings.yml** changes, we want to deploy all **template/wordpress-*.yml** files.

## More examples  

```yaml
name: push-develop
on: [push]
jobs:
  changes:
    runs-on: ubuntu-latest
    steps:
      - id: file_changes
        uses: trilom/file-changes-action@v1.2.3
      - name: test
        run: |
          cat $HOME/files.json
          cat $HOME/files_modified.json
          cat $HOME/files_added.json
          cat $HOME/files_removed.json
          echo '${{ steps.file_changes.outputs.files}}'
          echo '${{ steps.file_changes.outputs.files_modified}}'
          echo '${{ steps.file_changes.outputs.files_added}}'
          echo '${{ steps.file_changes.outputs.files_removed}}'
```

You can set the output and fileOutput to ',' for csv output.

```yaml
name: push-develop
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - id: file_changes
        uses: trilom/file-changes-action@v1.2.3
        with:
          output: ','
          fileOutput: ','
      - name: test
        run: |
          cat $HOME/files.csv
```

You can set the output and fileOutput to ' ' for txt output.  We also used a specific token, and got info for the PR that this push came from.

```yaml
name: push-develop
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@0.6.0
        id: pr
        with:
          github-token: ${{env.BOT_USER_TOKEN}}
          result-encoding: string
          script: |
            const result = await github.repos.listPullRequestsAssociatedWithCommit({
              owner: context.payload.repository.owner.name,
              repo: context.payload.repository.name,
              commit_sha: context.payload.head_commit.id
            })
            return result.data[0].number;
      - id: file_changes
        uses: trilom/file-changes-action@v1.2.3
        with:
          githubToken: ${{ env.BOT_USER_TOKEN }}
          prNumber: ${{ steps.pr.outputs.results }}
          output: ' '
          fileOutput: ' '
      - name: test
        run: |
          cat $HOME/files.txt
```
