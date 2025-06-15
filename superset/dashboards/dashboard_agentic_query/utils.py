import json
import ast

def correct_lst(input_str):
    first_open = -1
    last_close = -1
    for i in range(len(input_str)):
        if(input_str[i]=='[' and first_open==-1):
            first_open = i
        elif(input_str[i]==']'):
            last_close = i
    
    return input_str[first_open : last_close + 1]

def refactor_input(input_str):
    input_str = str(input_str)
    if('\n' in input_str):
        input_str = input_str.split('\n')[0]
    input_str = input_str.strip()
    if(input_str.startswith("'") or input_str.startswith('"')):
        input_str = input_str[1:]
    if(input_str.endswith("'") or input_str.endswith('"')):
        input_str = input_str[:-1]
    return input_str

def extract_int_if_possible(input_str):
    if(':' in input_str):
        input_str = input_str.split(':')[1]
    elif('=' in input_str):
        input_str = input_str.split('=')[1]
    
    return input_str.strip()

def extract_json_from_string(input_str):
    start_open_curly = -1
    end_close_curly = -1

    for i in range(len(input_str)):
        if(input_str[i] == '{' and start_open_curly == -1):
            start_open_curly = i
        elif(input_str[i] == '}'):
            end_close_curly = i
    
    input_str = input_str[start_open_curly: end_close_curly + 1]

    return input_str

def count_list_size(items_list) -> int:
    try:
        corrected_list = correct_lst(items_list)
        res = ast.literal_eval(corrected_list)
        return len(res)
    except Exception as err:
        return "Its not a list, error :: " + str(err)
