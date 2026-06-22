# Override for dev — use SQLite directly
SQLALCHEMY_DATABASE_URI = "sqlite:////app/superset_home/dev_database.db"
FEATURE_FLAGS = {
    "DATASET_RELATIONSHIPS": True,
}
