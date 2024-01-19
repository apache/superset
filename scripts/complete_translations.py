import glob
import polib
from langchain_community.callbacks import get_openai_callback
from langchain_openai import OpenAI
import json
import csv
import io

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



def generate_missing_translations(translations, missing_translations):
    translated_count = 0
    limit = 2
    with get_openai_callback() as cb:
        for msgid, missing_langs in missing_translations.items():
            translated_count += 1
            csv_output = io.StringIO()
            csv_writer = csv.writer(csv_output, quoting=csv.QUOTE_ALL)

            # Header for CSV
            csv_writer.writerow(['msgid', 'Language', 'Text'])

            # Existing translations
            for lang, trans in translations[msgid].items():
                if lang != 'en':
                    csv_writer.writerow([msgid, lang, trans])
                else:
                    csv_writer.writerow([msgid, lang, msgid])

            # Include rows for missing translations
            # for lang in missing_langs:
            #     csv_writer.writerow([msgid, lang, ''])

            csv_request = csv_output.getvalue()
            csv_output.close()

            template = f"Please review the following CSV input, generated from text in my .po language files:\n\n{csv_request}\n\Generate a CSV file for the missing languages {missing_langs} in the same format with the same headers. The `Text` column filled in for these missing languages, being sure to retain all whitespace/tabs/newlines from the original format in the `msgid` column, so that the translated text matches the original format.\n"

            if len(missing_langs) > 0 and translated_count < limit:
                print(f"template: \n{template}\n")
                result = llm.invoke(template)
                print(f"result:\n{result}\n")

                print(f"missing languages: {missing_langs}")
                      
                # Parse the response
                response_csv = io.StringIO(result.strip())
                csv_reader = csv.DictReader(response_csv)

                for row in csv_reader:
                    # Strip whitespace and check if the fields are not empty
                    if row.get('msgid', '') and row.get('Language', '') and row.get('Text', ''):
                        if row['msgid'] in translations:
                            print('msgid found in translations') 
                            if row['Language'] in missing_langs:
                                print(f"populating missing translation: {row['Language']}, {row['Text']}")
                                populate_missing_translation(translations, row['msgid'], row['Language'], row['Text']) 
                            else:
                                print(f"language {row['Language']} not needed")
                        else:
                            print('msgid not found in translations')
                response_csv.close()

        print("Translations updated.")


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
generate_missing_translations(translations, missing_translations)

update_po_files(glob_pattern, translations)

