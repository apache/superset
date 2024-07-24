"""
This file is used to load translations from the locale.yaml file and provide a function to get translations
"""

import yaml

TRANSLATIONS_FILE_PATH = "/app/localization/locale.yaml"
DATASET_STRINGS_FILE_PATH = "/app/localization/datasets_strings.yaml"

ASSETS_TRANSLATIONS = {}
with open(TRANSLATIONS_FILE_PATH, "r") as file:
    yaml_content = file.read()
    yaml_documents = yaml_content.split("\n---\n")

    for doc in yaml_documents:
        data = yaml.safe_load(doc)
        if data is not None:
            for lang, translations in data.items():
                if lang not in ASSETS_TRANSLATIONS:
                    ASSETS_TRANSLATIONS[lang] = {}
                ASSETS_TRANSLATIONS[lang].update(translations)


DATASET_STRINGS = yaml.safe_load(open(DATASET_STRINGS_FILE_PATH, "r"))


def get_translation(text, language):
    """Get a translation for a text in a language"""
    default_text = f"{text}"
    LANGUAGE = ASSETS_TRANSLATIONS.get(language, {})
    if not LANGUAGE:
        return default_text
    return ASSETS_TRANSLATIONS.get(language, {}).get(text) or default_text
