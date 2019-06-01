from superset.db_engine_specs.postgres import PostgresBaseEngineSpec


class RedshiftEngineSpec(PostgresBaseEngineSpec):
    engine = 'redshift'
    max_column_name_length = 127

    @staticmethod
    def mutate_label(label):
        """
        Redshift only supports lowercase column names and aliases.
        :param str label: Original label which might include uppercase letters
        :return: String that is supported by the database
        """
        return label.lower()
