import glob
import polib

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
print('Missing translations with available translations:')
print_missing_translations_with_available(translations, missing_translations)

# Example usage
msgid = "year"
language = "sk"
string = "rok"

populate_missing_translation(translations, msgid, language, string)

update_po_files(glob_pattern, translations)

