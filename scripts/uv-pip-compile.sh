uv pip compile pyproject.toml -c requirements/base.in -o requirements/base.txt
uv pip compile pyproject.toml requirements/development.in -c requirements/base.txt -o requirements/development.txt
