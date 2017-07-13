import os
import re

import itertools


class CI:
    def __init__(self, env=os.environ):
        self.env = env

    def predicate(self, service):
        return service["matcher"](self.env)

    def data(self):
        service = next(iter(filter(self.predicate, self.__services())), None)

        if service:
            return service["data"](self.env)
        else:
            return {}

    def __services(self):
        return [{
            "matcher": lambda env: env.get("TRAVIS"),
            "data": lambda env: {
                "name": "travis-ci",
                "branch": self.env.get("TRAVIS_BRANCH"),
                "build_identifier": self.env.get("TRAVIS_JOB_ID"),
                "pull_request": self.env.get("TRAVIS_PULL_REQUEST")
            }
        }, {
            "matcher": lambda env: env.get("CIRCLECI"),
            "data": lambda env: {
                "name": "circleci",
                "branch": self.env.get("CIRCLE_BRANCH"),
                "build_identifier": self.env.get("CIRCLE_BUILD_NUM"),
                "commit_sha": self.env.get("CIRCLE_SHA1")
            }
        }, {
            "matcher": lambda env: env.get("SEMAPHORE"),
            "data": lambda env: {
                "name": "semaphore",
                "branch": self.env.get("BRANCH_NAME"),
                "build_identifier": self.env.get("SEMAPHORE_BUILD_NUMBER")
            }
        }, {
            "matcher": lambda env: env.get("JENKINS_URL"),
            "data": lambda env: {
                "name": "jenkins",
                "build_identifier": self.env.get("BUILD_NUMBER"),
                "build_url": self.env.get("BUILD_URL"),
                "branch": self.env.get("GIT_BRANCH"),
                "commit_sha": self.env.get("GIT_COMMIT")
            }
        }, {
            "matcher": lambda env: env.get("TDDIUM"),
            "data": lambda env: {
                "name": "tddium",
                "build_identifier": self.env.get("TDDIUM_SESSION_ID"),
                "worker_id": self.env.get("TDDIUM_TID")
            }
        }, {
            "matcher": lambda env: env.get("WERCKER"),
            "data": lambda env: {
                "name": "wercker",
                "build_identifier": self.env.get("WERCKER_BUILD_ID"),
                "build_url": self.env.get("WERCKER_BUILD_URL"),
                "branch": self.env.get("WERCKER_GIT_BRANCH"),
                "commit_sha": self.env.get("WERCKER_GIT_COMMIT")
            }
        }, {
            "matcher": lambda env: env.get("APPVEYOR"),
            "data": lambda env: {
                "name": "appveyor",
                "build_identifier": self.env.get("APPVEYOR_BUILD_ID"),
                "build_url": self.env.get("APPVEYOR_API_URL"),
                "branch": self.env.get("APPVEYOR_REPO_BRANCH"),
                "commit_sha": self.env.get("APPVEYOR_REPO_COMMIT"),
                "pull_request": self.env.get("APPVEYOR_PULL_REQUEST_NUMBER")
            }
        }, {
            "matcher": lambda env: self.__ci_name_match("DRONE"),
            "data": lambda env: {
                "name": "drone",
                "build_identifier": self.env.get("CI_BUILD_NUMBER"),
                "build_url": self.env.get("CI_BUILD_URL"),
                "branch": self.env.get("CI_BRANCH"),
                "commit_sha": self.env.get("CI_COMMIT"),
                "pull_request": self.env.get("CI_PULL_REQUEST")
            }
        }, {
            "matcher": lambda env: self.__ci_name_match("CODESHIP"),
            "data": lambda env: {
                "name": "codeship",
                "build_identifier": self.env.get("CI_BUILD_NUMBER"),
                "build_url": self.env.get("CI_BUILD_URL"),
                "branch": self.env.get("CI_BRANCH"),
                "commit_sha": self.env.get("CI_COMMIT_ID")
            }
        }, {
            "matcher": lambda env: self.__ci_name_match("VEXOR"),
            "data": lambda env: {
                "name": "vexor",
                "build_identifier": self.env.get("CI_BUILD_NUMBER"),
                "build_url": self.env.get("CI_BUILD_URL"),
                "branch": self.env.get("CI_BRANCH"),
                "commit_sha": self.env.get("CI_BUILD_SHA"),
                "pull_request": self.env.get("CI_PULL_REQUEST_ID")
            }
        }, {
            "matcher": lambda env: env.get("BUILDKITE"),
            "data": lambda env: {
                "name": "buildkite",
                "build_identifier": self.env.get("BUILDKITE_JOB_ID"),
                "build_url": self.env.get("BUILDKITE_BUILD_URL"),
                "branch": self.env.get("BUILDKITE_BRANCH"),
                "commit_sha": self.env.get("BUILDKITE_COMMIT"),
            }
        }, {
            "matcher": lambda env: env.get("GITLAB_CI"),
            "data": lambda env: {
                "name": "gitlab-ci",
                "build_identifier": self.env.get("CI_BUILD_ID"),
                "branch": self.env.get("CI_BUILD_REF_NAME"),
                "commit_sha": self.env.get("CI_BUILD_REF"),
            }
        }]

    def __ci_name_match(self, pattern):
        ci_name = self.env.get("CI_NAME")

        return ci_name and re.match(pattern, ci_name, re.IGNORECASE)
