from superset.db_engine_specs.firebolt import FireboltEngineSpec
from tests.integration_tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestFireboltDbEngineSpec(TestDbEngineSpec):
    def test_convert_dttm(self):
        dttm = self.get_dttm()
        test_cases = {
            "DATE": "CAST('2019-01-02' AS DATE)",
            "DATETIME": "CAST('2019-01-02T03:04:05' AS DATETIME)",
            "TIMESTAMP": "CAST('2019-01-02T03:04:05' AS TIMESTAMP)",
            "UNKNOWNTYPE": None,
        }

        for target_type, expected in test_cases.items():
            actual = FireboltEngineSpec.convert_dttm(target_type, dttm)
            self.assertEqual(actual, expected)

    def test_epoch_to_dttm(self):
        assert (
            FireboltEngineSpec.epoch_to_dttm().format(col="timestamp_column")
            == "from_unixtime(timestamp_column)"
        )
