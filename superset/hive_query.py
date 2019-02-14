"""The file  Generate Hive DB partition based SQL query for any selected time range  and defined gran from superset UI,
   
    Use  below  data structure for extra_params in db metadata Extra section to enable partitions for hive
     "extra_params":{
        "partitions":{
         "year":"year",
         "month":"month",
         "day":"day",
         "hour":"hour",
         "minute":"minute"
         }
    }

"""
import json
import re
from datetime import timedelta

#gran valaue map
GRAN_VALUE_MAP =  {
    'PT1S' : 1,
    'PT5S' : 5,
    'PT10S' :10,
    'PT15S' :15,
    'PT30S': 30,
    'PT1M' : 60,
    'PT5M' : 300,
    'PT10M': 600,
    'PT15M': 900,
    'PT30M': 1800,
    'PT0.5H':1800,
    'PT1H' : 3600,
    'PT6H' : 21600,
    'P1D'  : 86400,
    'P1W'  : 604800,
    'P1M'  : 2629743,
    'P3M'  : 7889229,
    'P0.25Y': 7889229,
    'P1Y'  : 31556926
}

# return seconds from gran valaue map
def getGranValueInSeconds(value):
    if  value in GRAN_VALUE_MAP:
        return GRAN_VALUE_MAP[value]

    return None 

# return update sql for hive partitions db ,
# Here we replace simply default time range based where clause from sql to specific partition based  where clause
def defaultHiveQueryGenerator(sql, query_obj,database):

    # sample data structure for extra_params in db metadata to enable partitions for hive
    # "extra_params":{
    #     "partitions":{
    #     "year":"year",
    #     "month":"month",
    #     "day":"day",
    #     "hour":"hour",
    #     "minute":"minute"
    #     }
    # }

    print('-- DEFAULT_HIVE_QUERY_GENERATOR --')
    db_extra_metadata = json.loads(database.extra)
    print("db extra metadata ::",db_extra_metadata)
    if "extra_params" in  db_extra_metadata  and (database.backend == 'hive'):
        extra_params = db_extra_metadata["extra_params"]
        print("db extra_params:::",extra_params)
        if( "partitions" in extra_params ) :
            partitions = extra_params["partitions"]
            print("db partitions:::",partitions)
            st = query_obj['from_dttm']
            print('startdate--',st)
            en = query_obj['to_dttm']
            print('enddate--',en)
            gran_seconds = getGranValueInSeconds(query_obj['extras']['time_grain_sqla']) 
            print('gran_seconds--',gran_seconds)
            if st and en and gran_seconds :
                timeSeq = list()
                while st <= en:
                    timeSeq.append(st.strftime("( "+partitions['year']+" = %Y AND "+partitions['month']+" = %m AND "+partitions['day']+" = %d AND "+partitions['hour']+" = %H AND "+partitions['minute']+" = %M )"))
                    st = st + timedelta(seconds = gran_seconds)

                whereClause = " OR ".join(timeSeq) 

                # all time based  condition  should be in AND with other filters
                if timeSeq and len(timeSeq) > 1 :
                   whereClause = " ( " + whereClause + " ) "
            
                regex_st = "(`)((?:[a-z][a-z]+))(`)(\\s+)(>)(=)(\\s+)([+-]?\\d*\\.\\d+)(?![-+0-9\\.])"
                regex_et = "(AND)(\\s+)(`)((?:[a-z][a-z]+))(`)(\\s+)(<)(=)(\\s+)([+-]?\\d*\\.\\d+)(?![-+0-9\\.])"
            
                sql_updated = re.sub(regex_st, whereClause, sql)
                sql_updated = re.sub(regex_et, '\n', sql_updated)
            
                print('sql_updated ---->',sql_updated)
            
                return sql_updated 

            else:
                return   sql    

        else:
                return   sql  

    else:
        return   sql  