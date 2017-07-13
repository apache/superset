import os
import subprocess


class GitCommand:
    def branch(self):
        return self.__execute("git rev-parse --abbrev-ref HEAD")

    def committed_at(self):
        return self.__execute("git log -1 --pretty=format:%ct")

    def head(self):
        return self.__execute("git log -1 --pretty=format:'%H'")

    def __execute(self, command):
        process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE)
        exit_code = process.wait()

        if exit_code == 0:
            return process.stdout.read().decode("utf-8").strip()
        else:
            return None
