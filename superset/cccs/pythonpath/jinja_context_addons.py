import logging
logger = logging.getLogger(__name__)


import ipaddress
import struct
import socket

from typing import Any, Dict, List, Optional, Tuple
from superset.utils.core import FilterOperator


def ipv4str_to_number(addr):
    """
    Return the numerical representation of the provided ip string.
    
    :param addr: The ip string
    :returns: numerical value
    """
    if type(addr) == int:
        return addr
    else:
        return struct.unpack("!I", socket.inet_aton(addr.strip()))[0]


def render_ipv4_between_number_colums(start, end, val):
    """
    Return the rendering of an ip string value falling between a low
        and high ip column.
    
    :param low_col: The name of the low column.
    :param high_col: The name of the high column.
    :param val: An array of ip string values.
    :returns: SQL.
    """
    conditions = []
    for cidr in val:
        if type(cidr) == int:
            ip = cidr
            conditions.append(f'({start} <= {ip} AND {end} >= {ip})')
        else:
            ips = ipaddress.IPv4Network(cidr.strip())
            if ips.num_addresses > 1:
                # regex prevents calling this function with cidr values
                # if we ever want to support such values we would do it here.
                low = ipv4str_to_number(str(ips[0]))
                high = ipv4str_to_number(str(ips[ips.num_addresses - 1]))
                cond = f'''( ({start} <= {low} AND {end} >= {low})
                    OR ({start} <= {high} AND {end} >= {high}) 
                    OR ({low} <= {start} AND {end} <= {high}) )'''
                conditions.append(cond)
            else:
                ip = ipv4str_to_number(str(ips[0]))
                conditions.append(f'({start} <= {ip} AND {end} >= {ip})')
    # ("START_IP" >= 16777216 AND "END_IP" <= 16777216)
    # OR ("START_IP" >= 16777216 AND "END_IP" <= 3332232)
    # OR ("START_IP" >= 45689644 AND "END_IP" <= 45689644)
    return ' OR '.join(conditions)

def render_in_conditions(ip_array, ip_column_name):
    """
    Return the rendering of an ip string value on the provided column.
    
    :param ip_column_name: Name of the column.
    :param ip_array: A list of ip string values. These can include CIDR ranges.
    :returns: List of conditions to OR.
    """
    conditions = []
    for cidr in ip_array:
        if type(cidr) == int:
            ip = cidr
            conditions.append(f'({ip_column_name} = {ip})')
        else:
            ips = ipaddress.IPv4Network(cidr.strip())
            if ips.num_addresses > 1:
                low = ipv4str_to_number(str(ips[0]))
                high = ipv4str_to_number(str(ips[ips.num_addresses - 1]))
                conditions.append(
                    f'({ip_column_name} >= {low} AND {ip_column_name} <= {high})')
            else:
                ip = ipv4str_to_number(str(ips[0]))
                conditions.append(f'({ip_column_name} = {ip})')
    return conditions

def render_ipv4_number_column(col, op, val):
    """
    Return the rendering of an ip string value.


    :param col: The name of the column.
    :param op: The operator to render.
    :param val: Ip string value.
    :returns: SQL.
    """
    # SRC_IP = 122344
    # DST_IP <= 122344
    # IP <> 122344
    if op == FilterOperator.IN.value:
        return ' OR '.join(render_in_conditions(val, col))
    elif op == FilterOperator.EQUALS.value:
        ipnumvalue = ipv4str_to_number(val)
        return f'{col} = {ipnumvalue}'
    else:
        ipnumvalue = ipv4str_to_number(val)
        return f'{col} {op} {ipnumvalue}'

def render_ipv4_either_number_columns(src_col, dst_col, val):
    """
    Return the rendering of an ip string value matching either directions.
    
    :param src_col: The name of the source column.
    :param dst_col: The name of the destination column.
    :param val: A list of ip string values. These can include CIDR ranges.
    :returns: SQL.
    """
    # ('1.1.1.1', '2.0.0.0/24')
    # is replaced with an OR filter on both SRC_IP and DST_IP
    # ( SRC_IP = 22345 OR (SRC_IP >= 10000 AND SRC_IP <= 20000) )
    # OR
    # ( DST_IP = 22345 OR (DST_IP >= 10000 AND DST_IP <= 20000) )
    return ' OR '.join(render_in_conditions(val, src_col)
                     + render_in_conditions(val, dst_col))
    




# Register operator rendering functions
JINJA_CONTEXT_ADDONS = {
    'render_ipv4_between_number_colums': render_ipv4_between_number_colums,
    'render_ipv4_either_number_columns': render_ipv4_either_number_columns,
    'render_ipv4_number_column': render_ipv4_number_column
}

