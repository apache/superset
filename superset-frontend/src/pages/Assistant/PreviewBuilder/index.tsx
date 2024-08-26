import QueryStateLabel from '../../../SqlLab/components/QueryStateLabel';

const query = `
{
    "changed_on": "2024-08-26T11:31:45.853974",
    "dbId": 2,
    "db": "examples",
    "endDttm": 1724671905876.2031,
    "errorMessage": null,
    "executedSql": "SELECT\\n  *\\nFROM public.\\"FCC 2018 Survey\\"\\nLIMIT 21",
    "id": "oROvbMx0kPd",
    "queryId": 310,
    "limit": 20,
    "limitingFactor": "DROPDOWN",
    "progress": 100,
    "rows": 20,
    "catalog": null,
    "schema": "public",
    "ctas": false,
    "serverId": 310,
    "sql": "SELECT\\n  *\\nFROM public.\\"FCC 2018 Survey\\"\\nLIMIT 100",
    "sqlEditorId": "2",
    "startDttm": 1724671905798.5461,
    "state": "success",
    "tab": "Assistant Query Lab",
    "tempSchema": null,
    "tempTable": null,
    "userId": 1,
    "user": "Superset Admin",
    "resultsKey": "4ae3c1aa-439d-44df-9594-ad8dacc72994",
    "trackingUrl": null,
    "extra": {
        "cancel_query": 2560,
        "progress": null,
        "columns": [
            {
                "column_name": "ID",
                "name": "ID",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "is_software_dev",
                "name": "is_software_dev",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "is_first_dev_job",
                "name": "is_first_dev_job",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "months_job_search",
                "name": "months_job_search",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "job_pref",
                "name": "job_pref",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "job_intr_fllstck",
                "name": "job_intr_fllstck",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "job_intr_backend",
                "name": "job_intr_backend",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "job_intr_frntend",
                "name": "job_intr_frntend",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "job_intr_mobile",
                "name": "job_intr_mobile",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "job_intr_devops",
                "name": "job_intr_devops",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "job_intr_datasci",
                "name": "job_intr_datasci",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "job_intr_teacher",
                "name": "job_intr_teacher",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "job_intr_qa_engn",
                "name": "job_intr_qa_engn",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "job_intr_ux_engn",
                "name": "job_intr_ux_engn",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "job_intr_projm",
                "name": "job_intr_projm",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "job_intr_gamedev",
                "name": "job_intr_gamedev",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "job_intr_infosec",
                "name": "job_intr_infosec",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "job_intr_dataengn",
                "name": "job_intr_dataengn",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "job_intr_other",
                "name": "job_intr_other",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "when_appl_job",
                "name": "when_appl_job",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "expected_earn",
                "name": "expected_earn",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "job_lctn_pref",
                "name": "job_lctn_pref",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "job_relocate",
                "name": "job_relocate",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "reasons_to_code",
                "name": "reasons_to_code",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "reasons_to_code_other",
                "name": "reasons_to_code_other",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "rsrc_fcc",
                "name": "rsrc_fcc",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "rsrc_mdn",
                "name": "rsrc_mdn",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "rsrc_so",
                "name": "rsrc_so",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "rsrc_edx",
                "name": "rsrc_edx",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "rsrc_coursera",
                "name": "rsrc_coursera",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "rsrc_khan_acdm",
                "name": "rsrc_khan_acdm",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "rsrc_pluralsght",
                "name": "rsrc_pluralsght",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "rsrc_codeacdm",
                "name": "rsrc_codeacdm",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "rsrc_udacity",
                "name": "rsrc_udacity",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "rsrc_udemy",
                "name": "rsrc_udemy",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "rsrc_code_wars",
                "name": "rsrc_code_wars",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "rsrc_treehouse",
                "name": "rsrc_treehouse",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "rsrc_hackerrank",
                "name": "rsrc_hackerrank",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "rsrc_frntendmstr",
                "name": "rsrc_frntendmstr",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "rsrc_lynda",
                "name": "rsrc_lynda",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "rsrc_egghead",
                "name": "rsrc_egghead",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "rsrc_css_tricks",
                "name": "rsrc_css_tricks",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "rsrc_other",
                "name": "rsrc_other",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "codeevnt_fcc",
                "name": "codeevnt_fcc",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "codeevnt_hackthn",
                "name": "codeevnt_hackthn",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "codeevnt_confs",
                "name": "codeevnt_confs",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "codeevnt_workshps",
                "name": "codeevnt_workshps",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "codeevnt_startupwknd",
                "name": "codeevnt_startupwknd",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "codeevnt_nodeschl",
                "name": "codeevnt_nodeschl",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "codeevnt_womenwc",
                "name": "codeevnt_womenwc",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "codeevnt_girldevit",
                "name": "codeevnt_girldevit",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "codeevnt_coderdojo",
                "name": "codeevnt_coderdojo",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "codeevnt_meetup",
                "name": "codeevnt_meetup",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "codeevnt_railsbrdg",
                "name": "codeevnt_railsbrdg",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "codeevnt_gamejam",
                "name": "codeevnt_gamejam",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "codeevnt_railsgrls",
                "name": "codeevnt_railsgrls",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "codeevnt_djangogrls",
                "name": "codeevnt_djangogrls",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "codeevnt_wkndbtcmp",
                "name": "codeevnt_wkndbtcmp",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "codeevnt_other",
                "name": "codeevnt_other",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "podcast_fcc",
                "name": "podcast_fcc",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "podcast_codenewbie",
                "name": "podcast_codenewbie",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "podcast_changelog",
                "name": "podcast_changelog",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "podcast_sedaily",
                "name": "podcast_sedaily",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "podcast_js_jabber",
                "name": "podcast_js_jabber",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "podcast_syntaxfm",
                "name": "podcast_syntaxfm",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "podcast_ltcwm",
                "name": "podcast_ltcwm",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "podcast_fullstckrd",
                "name": "podcast_fullstckrd",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "podcast_frnthppyhr",
                "name": "podcast_frnthppyhr",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "podcast_codingblcks",
                "name": "podcast_codingblcks",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "podcast_shoptalk",
                "name": "podcast_shoptalk",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "podcast_devtea",
                "name": "podcast_devtea",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "podcast_progthrwdwn",
                "name": "podcast_progthrwdwn",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "podcast_geekspeak",
                "name": "podcast_geekspeak",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "podcast_hanselmnts",
                "name": "podcast_hanselmnts",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "podcast_talkpythonme",
                "name": "podcast_talkpythonme",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "podcast_rubyrogues",
                "name": "podcast_rubyrogues",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "podcast_codepenrd",
                "name": "podcast_codepenrd",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "podcast_seradio",
                "name": "podcast_seradio",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "podcast_other",
                "name": "podcast_other",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "yt_mit_ocw",
                "name": "yt_mit_ocw",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "yt_fcc",
                "name": "yt_fcc",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "yt_computerphile",
                "name": "yt_computerphile",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "yt_devtips",
                "name": "yt_devtips",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "yt_cs_dojo",
                "name": "yt_cs_dojo",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "yt_engn_truth",
                "name": "yt_engn_truth",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "yt_learncodeacdm",
                "name": "yt_learncodeacdm",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "yt_lvluptuts",
                "name": "yt_lvluptuts",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "yt_funfunfunct",
                "name": "yt_funfunfunct",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "yt_codingtuts360",
                "name": "yt_codingtuts360",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "yt_codingtrain",
                "name": "yt_codingtrain",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "yt_derekbanas",
                "name": "yt_derekbanas",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "yt_simplilearn",
                "name": "yt_simplilearn",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "yt_simpleprog",
                "name": "yt_simpleprog",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "yt_mozillahacks",
                "name": "yt_mozillahacks",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "yt_googledevs",
                "name": "yt_googledevs",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "yt_other",
                "name": "yt_other",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "hours_learning",
                "name": "hours_learning",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "months_programming",
                "name": "months_programming",
                "type": "LONGINTEGER",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "bootcamp_attend",
                "name": "bootcamp_attend",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "bootcamp_name",
                "name": "bootcamp_name",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "bootcamp_finished",
                "name": "bootcamp_finished",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "bootcamp_have_loan",
                "name": "bootcamp_have_loan",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "bootcamp_recommend",
                "name": "bootcamp_recommend",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "money_for_learning",
                "name": "money_for_learning",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "age",
                "name": "age",
                "type": "LONGINTEGER",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "gender",
                "name": "gender",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "gender_other",
                "name": "gender_other",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "country_citizen",
                "name": "country_citizen",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "country_live",
                "name": "country_live",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "live_city_population",
                "name": "live_city_population",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "is_ethnic_minority",
                "name": "is_ethnic_minority",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "lang_at_home",
                "name": "lang_at_home",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "school_degree",
                "name": "school_degree",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "school_major",
                "name": "school_major",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "marital_status",
                "name": "marital_status",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "has_finance_depends",
                "name": "has_finance_depends",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "has_children",
                "name": "has_children",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "num_children",
                "name": "num_children",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "do_finance_support",
                "name": "do_finance_support",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "debt_amt",
                "name": "debt_amt",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "home_mrtg_has",
                "name": "home_mrtg_has",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "home_mrtg_owe",
                "name": "home_mrtg_owe",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "student_debt_has",
                "name": "student_debt_has",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "student_debt_amt",
                "name": "student_debt_amt",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "curr_emplymnt",
                "name": "curr_emplymnt",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "curr_emplymnt_other",
                "name": "curr_emplymnt_other",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "curr_field",
                "name": "curr_field",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "last_yr_income",
                "name": "last_yr_income",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "communite_time",
                "name": "communite_time",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "is_self_employed",
                "name": "is_self_employed",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "has_served_military",
                "name": "has_served_military",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "is_recv_disab_bnft",
                "name": "is_recv_disab_bnft",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "has_high_spd_ntnet",
                "name": "has_high_spd_ntnet",
                "type": "FLOAT",
                "type_generic": 0,
                "is_dttm": false
            },
            {
                "column_name": "time_start",
                "name": "time_start",
                "type": "DATETIME",
                "type_generic": 2,
                "is_dttm": true
            },
            {
                "column_name": "time_end",
                "name": "time_end",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "network_id",
                "name": "network_id",
                "type": "STRING",
                "type_generic": 1,
                "is_dttm": false
            },
            {
                "column_name": "time_total_sec",
                "name": "time_total_sec",
                "type": "LONGINTEGER",
                "type_generic": 0,
                "is_dttm": false
            }
        ]
    }
}
`

/**
 * Props
 */
export interface QueryResultTableProps {
    query: {};
}

const testProps = {
    query: JSON.parse(query)
}

export function QueryResultTable() {
    const props: QueryResultTableProps = testProps;
    console.log("Query Result Table Props", props);
    return (
        <QueryStateLabel
            query={props.query}
        />
    );

}