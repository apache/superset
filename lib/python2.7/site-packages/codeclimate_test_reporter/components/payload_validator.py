class InvalidPayload(Exception):
    pass


class PayloadValidator:
    def __init__(self, payload):
        self.payload = payload

    def validate(self):
        if not self.__commit_sha():
            raise InvalidPayload("A git commit sha was not found in the test report payload")
        elif not self.__committed_at():
            raise InvalidPayload("A git commit timestamp was not found in the test report payload")
        elif not self.__run_at():
            raise InvalidPayload("A run at timestamp was not found in the test report payload")
        elif not self.__source_files():
            raise InvalidPayload("No source files were found in the test report payload")
        elif not self.__valid_source_files():
            raise InvalidPayload("Invalid source files were found in the test report payload")
        else:
            return True

    def __commit_sha(self):
        return self.__commit_sha_from_git() or self.__commit_sha_from_ci_service()

    def __commit_sha_from_git(self):
        return self.__validate_payload_value(["git", "head"])

    def __commit_sha_from_ci_service(self):
        return self.__validate_payload_value(["ci_service", "commit_sha"])

    def __committed_at(self):
        return self.__validate_payload_value(["git", "committed_at"])

    def __run_at(self):
        return self.payload.get("run_at")

    def __source_files(self):
        return self.payload.get("source_files")

    def __validate_payload_value(self, keys):
        current = self.payload

        for key in keys:
            next = current.get(key)

            if next:
                current = next
            else:
                return False

        return True

    def __valid_source_files(self):
        return all(self.__valid_source_file(source_file) for source_file in self.__source_files())

    def __valid_source_file(self, source_file):
        return type(source_file) is dict and source_file.get("name") and source_file.get("coverage")
