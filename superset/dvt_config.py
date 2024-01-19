from superset.dvt_initialization import DVTAppInitializer
from superset.dvt_security_manager.security_manager import DVTSecurityManager

APP_INITIALIZER = DVTAppInitializer  # pylint: disable=invalid-name
CUSTOM_SECURITY_MANAGER = (
    DVTSecurityManager  # pylint: disable=invalid-name # type: ignore
)

LANGUAGES = {
    "en": {"flag": "us", "name": "English"},
    "tr": {"flag": "tr", "name": "Turkish"},
}

# Replace this code block with scripts/po2json.sh
# for file in $( find superset/translations/** );
# do
#   extension="${file##*.}"
#   filename="${file%.*}"
#   if [ "$extension" = "po" ]
#   then
#     po2json --domain superset --format jed1.x "$file" "$filename.json"
#     ./superset-frontend/node_modules/.bin/prettier --write "$filename.json"
#   fi
# done
