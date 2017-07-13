import xml.etree.ElementTree as ET

from ..__init__ import __version__ as reporter_version
from .ci import CI
from .file_coverage import FileCoverage
from .git_command import GitCommand


class InvalidReportVersion(Exception):
    pass


class Formatter:
    def __init__(self, xml_report_path, debug=False):
        self.debug = debug
        tree = ET.parse(xml_report_path)
        self.root = tree.getroot()

    def payload(self):
        self.__validate_report_version()

        total_line_counts = {"covered": 0, "missed": 0, "total": 0}
        total_covered_strength = 0.0
        total_covered_percent = 0.0

        source_files = self.__source_files()

        for source_file in source_files:
            total_covered_strength += source_file["covered_strength"]
            total_covered_percent += source_file["covered_percent"]

            for key, value in source_file["line_counts"].items():
                total_line_counts[key] += value

        total_covered_strength = round(total_covered_strength / len(source_files), 2)
        total_covered_percent = round(total_covered_percent / len(source_files), 2)

        return {
            "run_at": self.__timestamp(),
            "covered_percent": total_covered_percent,
            "covered_strength": total_covered_strength,
            "line_counts": total_line_counts,
            "partial": False,
            "git": self.__git_info(),
            "environment": {
                "pwd": self.root.find("sources").find("source").text,
                "reporter_version": reporter_version
            },
            "ci_service": self.__ci_data(),
            "source_files": source_files
        }

    def __validate_report_version(self):
        report_version = self.root.get("version")

        if report_version < "4.0" or report_version >= "4.4":
            message = """
            This reporter is compatible with Coverage.py versions >=4.0,<4.4.
            Your Coverage.py report version is %s.

            Consider locking your version of Coverage.py to >4,0,<4.4 until the
            following Coverage.py issue is addressed:
            https://bitbucket.org/ned/coveragepy/issues/578/incomplete-file-path-in-xml-report
            """ % (report_version)

            raise InvalidReportVersion(message)

    def __ci_data(self):
        return CI().data()

    def __source_files(self):
        source_files = []

        for file_node in self.__file_nodes():
            if self.debug:
                print("Processing file path=%s" % file_node.get("filename"))

            file_coverage = FileCoverage(file_node)
            payload = file_coverage.payload()
            source_files.append(payload)

        return source_files

    def __file_nodes(self):
        return self.root.findall("packages/package/classes/class")

    def __timestamp(self):
        return self.root.get("timestamp")

    def __git_info(self):
        ci_data = self.__ci_data()
        command = GitCommand()

        return {
            "branch": ci_data.get("branch") or command.branch(),
            "committed_at": command.committed_at(),
            "head": ci_data.get("commit_sha") or command.head()
        }
