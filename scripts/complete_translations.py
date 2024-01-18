import glob
import polib
from langchain_community.callbacks import get_openai_callback
from langchain_openai import OpenAI
import json

llm = OpenAI(model_name="gpt-3.5-turbo-instruct", n=2, best_of=2)

def read_po_files(glob_pattern):
    translations = {}
    for file_path in glob.glob(glob_pattern, recursive=True):
        if file_path.endswith('.po'):
            po = polib.pofile(file_path)
            lang = file_path.split('/')[-3]  # Adjust according to your path structure
            for entry in po:
                if entry.msgid not in translations:
                    translations[entry.msgid] = {}
                translations[entry.msgid][lang] = entry.msgstr
    return translations

def find_missing_translations(translations):
    missing_translations = {}
    for msgid, langs in translations.items():
        for lang, msgstr in langs.items():
                if lang != 'en' and not msgstr:  # Ignore missing translations in 'en' language files
                    if msgid not in missing_translations:
                        missing_translations[msgid] = []
                    missing_translations[msgid].append(lang)
    return missing_translations

def update_po_files(glob_pattern, translations):
    for file_path in glob.glob(glob_pattern, recursive=True):
        if file_path.endswith('.po'):
            po = polib.pofile(file_path)
            lang = file_path.split('/')[-3]  # Adjust according to your path structure
            for entry in po:
                if entry.msgid in translations and lang in translations[entry.msgid]:
                    entry.msgstr = translations[entry.msgid][lang]
            po.save(file_path)

def print_missing_translations_with_available(translations, missing_translations):
    missing_translations_count = 0
    for msgid, missing_langs in missing_translations.items():
        print(f"msgid: {msgid}")
        print("missing_translation:", ', '.join(missing_langs))
        print("available translations:")
        for lang, trans in translations[msgid].items():
            if trans:  # Check if translation is not empty
                missing_translations_count += 1
                print(f"  '{lang}': {trans}")
    print(f"Missing translations count: {missing_translations_count}")

limit = 10;

def generate_missing_translations(translations, missing_translations):
    with get_openai_callback() as cb:
        missing_translations_count = 0
        for msgid, missing_langs in missing_translations.items():
            for target_lang in missing_langs:
                missing_translations_count += 1

                template = "I have the following JSON object of `msgid` and `msgstr` strings pulled from a .po file:\n"
                template += "{\n"
                template += f"\t\"msgid\": \"{msgid}\",\n"
                template += "\t\"translations\": {\n"

                translations_items = list(translations[msgid].items())
                total_items = len(translations_items)

                for index, (lang, trans) in enumerate(translations_items):
                    if trans:  # Check if translation is not empty
                        template += f"\t\t\"{lang}\": \"{trans}\""
                        if index < total_items - 1:  # If it's not the last item
                            template += ","
                        template += "\n"

                template += "\t}\n"
                template += "}\n\n"
                template += f"I'm missing the translation for the '{target_lang}' language\n"
                template += "Respond with a JSON object and nothing else. The json object should have the `msgid` key/value pair as specified in my JSON object, and the `msgstr` key/value pair with the translated string (including any relevant whitespace)\n"
                # template += "Respond with the translated `msgstr` value (including any whitespace) and nothing else. The json object should have the `msgid` key/value pair as specified in my JSON object, and the `msgstr` key/value pair with the translated string (including any relevant whitespace)\n"

                if missing_translations_count < 20:
                    result = llm.invoke(template)

                    try:
                        result = result.strip()
                        # Parse the corrected string
                        parsed_data = json.loads(result)

                        if "msgid" in parsed_data and "msgstr" in parsed_data and parsed_data["msgid"] and parsed_data["msgstr"]:
                            print('SUCCESS!')
                            populate_missing_translation(translations, parsed_data["msgid"], target_lang, parsed_data["msgstr"])
                    except json.JSONDecodeError as e:
                        print(f"Error parsing JSON: {e}")
                        print("Result:", result)



        print(f"Missing translations count: {missing_translations_count}")
    print(cb)
    

def populate_missing_translation(translations, msgid, language, string):
    if msgid in translations:
        translations[msgid][language] = string
    else:
        print(f"Warning: msgid '{msgid}' not found in translations.")

# Main process
glob_pattern = '../superset/translations/**/LC_MESSAGES/*.po'
translations = read_po_files(glob_pattern)
missing_translations = find_missing_translations(translations)

# print('Missing translations:')
# print(missing_translations)
# print('Missing translations with available translations:')
# print_missing_translations_with_available(translations, missing_translations)
generate_missing_translations(translations, missing_translations)

update_po_files(glob_pattern, translations)

