json_output='["functions/twitch-sadako/webhookSubscribeLambda/test/webhookSubscribeLambda.json", "functions/twitch-sadako/webhookSubscribeLambda/test/webhookSubscribeLambda_post.json", "functions/twitch-sadako/webhookSubscribeLambda/test/webhookSubscribeLambda_post.json", "functions/twitch-sadako/webhookSubscribeLambda/test/webhookSubscribeLambda_post.json"]'
csv_output="functions/twitch-sadako/webhookSubscribeLambda/test/webhookSubscribeLambda.json,functions/twitch-sadako/webhookSubscribeLambda/test/webhookSubscribeLambda_post.json,functions/twitch-sadako/webhookSubscribeLambda/test/webhookSubscribeLambda_post.json,functions/twitch-sadako/webhookSubscribeLambda/test/webhookSubscribeLambda_post.json"
txt_hard_output='functions/twitch-sadako/webhookSubscribeLambda/test/webhookSubscribeLambda.json_<br />&nbsp;&nbsp;_functions/twitch-sadako/webhookSubscribeLambda/test/webhookSubscribeLambda_post.json_<br />&nbsp;&nbsp;_functions/twitch-sadako/webhookSubscribeLambda/test/webhookSubscribeLambda_post.json_<br />&nbsp;&nbsp;_functions/twitch-sadako/webhookSubscribeLambda/test/webhookSubscribeLambda_post.json'
txt_output='functions/twitch-sadako/webhookSubscribeLambda/test/webhookSubscribeLambda.json functions/twitch-sadako/webhookSubscribeLambda/test/webhookSubscribeLambda_post.json functions/twitch-sadako/webhookSubscribeLambda/test/webhookSubscribeLambda_post.json functions/twitch-sadako/webhookSubscribeLambda/test/webhookSubscribeLambda_post.json'

testOutput () {
    # read from var
    if [ "${2}" == "json" ]; then
        local output_length=$(echo "${1}" | jq '. | length')
    elif [ "${2}" == "," ]; then
        local output_length=$(awk -F"${2}" '{print NF-1}' <<< $(echo "${1}"))
    else
        local output_length=$(awk -F"${2}" '{print NF-1}' <<< $(echo "${1}"))
    fi
    echo "$output_length"
}

testFile () {
    # read from file
    if [ "${2}" == "json" ]; then
        local file_length=$(jq -r '. | length' ${file}.json)
    elif [ "${2}" == "," ]; then
        local file_length=$(cat ${file}.csv | awk -F"${2}" '{print NF-1}')
    else
        local file_length=$(cat ${file}.txt | awk -F"${2}" '{print NF-1}')
    fi
    echo "$file_length"
}

cleanTest () {
    rm -rf $1.json $1.csv $1.txt
}

prepareTest () {
    # if prefix is simple setup test var and file
    if [ "$1" == "simple_" ]; then
        # declare a var named simple_FILE
        if [ "$dev" == "dev" ]; then
            local file_prefix="events/"
        else
            local file_prefix=""
        fi
        declare -n file=${1}${2}
        if [ "$3" == "json" ]; then
            echo ${json_output} > "${file_prefix}${!file}.json"
        elif [ "$3" == "," ]; then
            echo ${csv_output} > "${file_prefix}${!file}.csv"
        elif [ "$3" == "_<br />&nbsp;&nbsp;_" ]; then
            echo ${txt_hard_output} > "${file_prefix}${!file}.txt"
        else
            echo ${txt_output} > "${file_prefix}${!file}.txt"
        fi
        if [ "$4" == "json" ]; then
            file=$json_output
        elif [ "$4" == "," ]; then
            file=$csv_output
        elif [ "$4" == "_<br />&nbsp;&nbsp;_" ]; then
            file=$txt_hard_output
        else
            file=$txt_output
        fi
    else
        declare -n file=${2}
        if [ "$dev" == "dev" ]; then
            if [ "$4" == "json" ]; then
                file="$(cat events/${!file}.json)"
            elif [ "$4" == "," ]; then
                file="$(cat events/${!file}.csv)"
            else
                file="$(cat events/${!file}.txt)"
            fi
        fi
    fi
    echo "${file}"
}

testResults () {
    if [ "$1" == 'simple_' ]; then
        expected=3
        if [ "$2" == 'json' ]; then
            expected=$(($expected+1))
        fi
        # echo $result
        if [ "$3" != "$expected" ]; then
            echo -e "\t\033[1;91mTest failure $5/($1)$4:'$2' { EXPECTED:$expected RECEIVED:$3 } \033[0m"
            exit 1;
        fi
    else
        if [ "$4" == 'files' ]; then
            expected=72
        elif [ "$4" == 'files_added' ]; then
            expected=51
        elif [ "$4" == 'files_modified' ]; then
            expected=12
        elif [ "$4" == 'files_removed' ]; then
            expected=7
        fi
        if [ "$2" == 'json' ]; then
            expected=$(($expected+1))
        fi
        if [ "$3" != "$expected" ]; then
            echo -e "\t\033[1;91mTest failure $5/($1)$4:'$2' { EXPECTED:$expected RECEIVED:$3 } \033[0m"
            exit 1;
        fi
    fi
    echo -e "\t\033[1;92mTest success $5/($1)$4:'$2' { $expected == $3 } \033[0m"
}

runTest () {
    for prefix in "simple_" "real"; do \
        file=${1}
        if [ "$prefix" == 'simple_' ]; then
            if [ "$dev" == "dev" ]; then
                file=events/${prefix}${1}
            else
                file=${prefix}${1}
            fi
        elif [ "$prefix" != 'simple_' ] && [ "$dev" == "dev" ]; then
            file=events/${1}
        fi
        input="$(prepareTest $prefix $1 "$2" "$3")"
        local file_length=$(testFile $file "${2}")
        local output_length=$(testOutput "${input}" "${3}")
        testResults $prefix "${2}" "$file_length" "$1" "fileOutput"
        testResults $prefix "${3}" "$output_length" "$1" "output"
        if [ "$prefix" == 'simple_' ]; then
            cleanTest $file
        fi
    done
}

test () {
    if [ "$dev" == "dev" ]; then
        echo -e "\t\033[1;91mDEV MODE\033[0m"
    fi
    if [ "$output" == "" ] || [ "$fileOutput" == "" ]; then
        for fileOutput in "json" "," " "; do \
            echo -e "\033[1;92mFILEOUTPUT:'$fileOutput'\033[0m"
            for output in "json" "," " "; do \
                echo -e "\033[1;92mOUTPUT:'$output'\033[0m"
                for file in "files" "files_modified" "files_added" "files_removed"; do \
                    echo -e "\033[1;92mFILE:'$file'\033[0m"
                    runTest $file "$fileOutput" "$output"
                done
            done
        done
    else
        for file in "files" "files_modified" "files_added" "files_removed"; do \
            echo -e "\033[1;92mFILE:'$file' with FILEOUTPUT:'$fileOutput' OUTPUT:'$output'\033[0m"
            runTest $file "$fileOutput" "$output"
        done
    fi
}

dev=$1

test
