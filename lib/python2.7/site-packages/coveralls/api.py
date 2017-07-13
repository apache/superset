# coding: utf-8
import codecs
import json
import logging
import os
import re
from subprocess import Popen, PIPE

import coverage
import requests

from .reporter import CoverallReporter


log = logging.getLogger('coveralls')


class CoverallsException(Exception):
    pass


class Coveralls(object):
    config_filename = '.coveralls.yml'
    api_endpoint = 'https://coveralls.io/api/v1/jobs'
    default_client = 'coveralls-python'

    def __init__(self, token_required=True, **kwargs):
        """ Coveralls!

        * repo_token
          The secret token for your repository, found at the bottom of your repository's
           page on Coveralls.

        * service_name
          The CI service or other environment in which the test suite was run.
          This can be anything, but certain services have special features
          (travis-ci, travis-pro, or coveralls-ruby).

        * [service_job_id]
          A unique identifier of the job on the service specified by service_name.
        """
        self._data = None
        self.config = kwargs
        file_config = self.load_config() or {}
        repo_token = self.config.get('repo_token') or file_config.get('repo_token', None)
        if repo_token:
            self.config['repo_token'] = repo_token

        if os.environ.get('TRAVIS'):
            is_travis_or_circle = True
            self.config['service_name'] = file_config.get('service_name', None) or 'travis-ci'
            self.config['service_job_id'] = os.environ.get('TRAVIS_JOB_ID')
        elif os.environ.get('CIRCLECI'):
            is_travis_or_circle = True
            self.config['service_name'] = file_config.get('service_name', None) or 'circle-ci'
            self.config['service_job_id'] = os.environ.get('CIRCLE_BUILD_NUM')
            if os.environ.get('CI_PULL_REQUEST', None):
                self.config['service_pull_request'] = os.environ.get('CI_PULL_REQUEST').split('/')[-1]
        else:
            is_travis_or_circle = False
            self.config['service_name'] = file_config.get('service_name') or self.default_client

        if os.environ.get('COVERALLS_REPO_TOKEN', None):
            self.config['repo_token'] = os.environ.get('COVERALLS_REPO_TOKEN')

        if token_required and not self.config.get('repo_token') and not is_travis_or_circle:
            raise CoverallsException('You have to provide either repo_token in %s, or launch via Travis or CircleCI'
                                     % self.config_filename)

    def load_config(self):
        try:
            import yaml
            return yaml.safe_load(open(os.path.join(os.getcwd(), self.config_filename)))
        except ImportError:
            return {}
        except (OSError, IOError):
            log.debug('Missing %s file. Using only env variables.', self.config_filename)
            return {}

    def merge(self, path):
        reader = codecs.getreader("utf-8")
        with open(path, 'rb') as fh:
            extra = json.load(reader(fh))
            self.create_data(extra)

    def wear(self, dry_run=False):
        """ run! """
        try:
            json_string = self.create_report()
        except coverage.CoverageException as e:
            return {'message': 'Failure to gather coverage: %s' % str(e)}
        if not dry_run:
            response = requests.post(self.api_endpoint, files={'json_file': json_string})
            try:
                result = response.json()
            except ValueError:
                result = {'message': 'Failure to submit data. Response [%(status)s]: %(text)s' % {
                    'status': response.status_code,
                    'text': response.text}}
        else:
            result = {}
        return result

    def create_report(self):
        """Generate json dumped report for coveralls api."""

        data = self.create_data()
        try:
            json_string = json.dumps(data)
        except UnicodeDecodeError as e:
            log.error("ERROR: While preparing JSON received exception: %s" % e)
            self.debug_bad_encoding(data)
            raise
        else:
            log_string = re.sub(r'"repo_token": "(.+?)"', '"repo_token": "[secure]"', json_string)
            log.debug(log_string)
            log.debug("==\nReporting %s files\n==\n" % len(data['source_files']))
            for source_file in data['source_files']:
                log.debug('%s - %s/%s' % (source_file['name'],
                                          sum(filter(None, source_file['coverage'])),
                                          len(source_file['coverage'])))
            return json_string

    def save_report(self, file_path):
        """Write coveralls report to file."""

        with open(file_path, 'w') as report_file:
            try:
                report = self.create_report()
            except coverage.CoverageException as e:
                logging.error('Failure to gather coverage: %s' % str(e))
            else:
                report_file.write(report)

    def create_data(self, extra=None):
        """ Generate object for api.
            Example json:
            {
                "service_job_id": "1234567890",
                "service_name": "travis-ci",
                "source_files": [
                    {
                        "name": "example.py",
                        "source": "def four\n  4\nend",
                        "coverage": [null, 1, null]
                    },
                    {
                        "name": "two.py",
                        "source": "def seven\n  eight\n  nine\nend",
                        "coverage": [null, 1, 0, null]
                    }
                ]
            }
        """
        if not self._data:
            self._data = {'source_files': self.get_coverage()}
            self._data.update(self.git_info())
            self._data.update(self.config)
            if extra:
                if 'source_files' in extra:
                    self._data['source_files'].extend(extra['source_files'])
                else:
                    log.warn('No data to be merged; does the json file contain "source_files" data?')
        return self._data

    def get_coverage(self):
        workman = coverage.coverage(config_file=self.config.get('config_file', True))
        workman.load()
        if hasattr(workman, '_harvest_data'):
            workman._harvest_data()
        else:
            workman.get_data()
        reporter = CoverallReporter(workman, workman.config)
        return reporter.report()

    def git_info(self):
        """ A hash of Git data that can be used to display more information to users.

            Example:
            "git": {
                "head": {
                    "id": "5e837ce92220be64821128a70f6093f836dd2c05",
                    "author_name": "Wil Gieseler",
                    "author_email": "wil@example.com",
                    "committer_name": "Wil Gieseler",
                    "committer_email": "wil@example.com",
                    "message": "depend on simplecov >= 0.7"
                },
                "branch": "master",
                "remotes": [{
                    "name": "origin",
                    "url": "https://github.com/lemurheavy/coveralls-ruby.git"
                }]
            }
        """

        rev = run_command('git', 'rev-parse', '--abbrev-ref', 'HEAD').strip()
        git_info = {'git': {
            'head': {
                'id': gitlog('%H'),
                'author_name': gitlog('%aN'),
                'author_email': gitlog('%ae'),
                'committer_name': gitlog('%cN'),
                'committer_email': gitlog('%ce'),
                'message': gitlog('%s'),
            },
            'branch': os.environ.get('CIRCLE_BRANCH') or os.environ.get('CI_BRANCH') or os.environ.get('TRAVIS_BRANCH', rev),
            #origin	git@github.com:coagulant/coveralls-python.git (fetch)
            'remotes': [{'name': line.split()[0], 'url': line.split()[1]}
                        for line in run_command('git', 'remote', '-v').splitlines() if '(fetch)' in line]
        }}
        return git_info

    def debug_bad_encoding(self, data):
        """ Let's try to help user figure out what is at fault"""
        at_fault_files = set()
        for source_file_data in data['source_files']:
            for key, value in source_file_data.items():
                try:
                    json.dumps(value)
                except UnicodeDecodeError:
                    at_fault_files.add(source_file_data['name'])
        if at_fault_files:
            log.error("HINT: Following files cannot be decoded properly into unicode."
                      "Check their content: %s" % (', '.join(at_fault_files)))


def gitlog(format):
    try:
        log = str(run_command('git', '--no-pager', 'log', "-1", '--pretty=format:%s' % format))
    except UnicodeEncodeError:
        log = unicode(run_command('git', '--no-pager', 'log', "-1", '--pretty=format:%s' % format))
    return log


def run_command(*args):
    cmd = Popen(list(args), stdout=PIPE, stderr=PIPE)
    stdout, stderr = cmd.communicate()
    assert cmd.returncode == 0, ('command return code %d, STDOUT: "%s"\n'
                                 'STDERR: "%s"' % (cmd.returncode, stdout, stderr))
    try:
        output = stdout.decode()
    except UnicodeDecodeError:
        output = stdout.decode('utf-8')
    return output
