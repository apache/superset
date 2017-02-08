#!/usr/bin/python

from __future__ import print_function

from datetime import datetime
import logging
import numpy
import re
import sys


def parse(log_text):
    verbose = False
    queryKey = "NONE"

    # Regular expressions we use.
    containerIdRe = re.compile("^Container: (container_\d+_\d+_\d+_\d+)")
    vertexNameRe = re.compile("VertexName: ([^,]+)")
    bytesRe = re.compile("BYTES_READ=(\d+)")
    bytesWriteRe = re.compile("BYTES_WRITTEN=(\d+)")
    recordsRe = re.compile("INPUT_RECORDS_PROCESSED=(\d+)")
    exceptionRe = re.compile("([A-Za-z]+Exception)")
    timeRe = re.compile("(\d{4}-\d{2}-\d{2} \S+)")
    taskFinishedRe = re.compile("\[Event:TASK_FINISHED\]: vertexName=([^,]+)")
    taskCounterRe = re.compile("([A-Z_]+=\d+)")

    # Static strings.
    nonzeroString = "non-zero"
    syslogAttemptString = "syslog_attempt"
    taskCompleteString = "Task completed"
    dagFinishedString = "Event:DAG_FINISHED"

    # Tracked statistics.
    stats = {}
    globalStats = {}
    dagStats = {}
    counterStats = {}
    exceptions = {}
    resetStats(stats)
    blackout = True

    # Parse the log file.
    for line in log_text.splitlines():
        # Look for a new container.
        result = re.match(containerIdRe, line)
        if result != None:
            if stats["containerName"] != None:
                printStats(stats, verbose)
                resetStats(stats)
                blackout = True
            logging.info("Starting New Container:")
            stats["containerName"] = result.group(1)

        # Look for the vertex name.
        result = re.search(vertexNameRe, line)
        if result != None:
            vName = result.group(1)
            if stats["vertexName"] == None:
                logging.info("Vertex name set to " + vName)
                stats["vertexName"] = vName
            elif vName != stats["vertexName"]:
                cName = stats["containerName"]
                printStats(stats, verbose)
                resetStats(stats)
                logging.info("Changing vertex name to " + vName)
                stats["containerName"] = cName
                stats["vertexName"] = vName
            if globalStats.has_key(vName):
                globalStats[vName]["totalContainers"] += 1
            else:
                globalStats[vName] = {}
                globalStats[vName]["totalContainers"] = 1
                globalStats[vName]["totalBytes"] = 0
                globalStats[vName]["totalBytesWrite"] = 0
                globalStats[vName]["totalRecs"] = 0
                globalStats[vName]["byteObservations"] = []

        # Look for data read.
        reads = re.findall(bytesRe, line)
        if len(reads) > 0:
            found = sum([int(x) for x in reads])
            logging.info("Bytes " + str(found))
            stats["nBytes"] += found
            if stats.has_key("vertexName"):
                vName = stats["vertexName"]
                if globalStats.has_key(vName):
                    logging.info("Add bytes to " + vName)
                    globalStats[vName]["totalBytes"] += found
                    globalStats[vName]["byteObservations"].extend([found])
            else:
                print("Error: Data read outside of named vertex")

        # Data Written.
        writes = re.findall(bytesWriteRe, line)
        if len(writes) > 0:
            found = sum([int(x) for x in writes])
            logging.info("Bytes Written " + str(found))
            stats["nBytesWrite"] += found
            if stats.has_key("vertexName"):
                vName = stats["vertexName"]
                if globalStats.has_key(vName):
                    logging.info("Add bytes to " + vName)
                    globalStats[vName]["totalBytesWrite"] += found
                    # globalStats[vName]["byteObservations"].extend([found])
            else:
                print("Error: Data read outside of named vertex")

        # Look for records read.
        records = re.findall(recordsRe, line)
        if len(records) > 0:
            found = sum([int(x) for x in reads])
            logging.info("Records " + str(found))
            stats["nRecs"] += found
            if stats.has_key("vertexName"):
                vName = stats["vertexName"]
                if globalStats.has_key(vName):
                    logging.info("Add records to " + vName)
                    globalStats[vName]["totalRecs"] += found
            else:
                print("Error: Records read outside of named vertex")

        # Look for finished tasks.
        result = re.search(taskFinishedRe, line)
        if result != None:
            vName = result.group(1)

            # Extract task counters.
            logging.info("Extracting counters for " + vName)
            counters = re.findall(taskCounterRe, line)
            if not counterStats.has_key(vName):
                counterStats[vName] = {}
                counterStats[vName]["startTime"] = sys.maxint
                counterStats[vName]["finishTime"] = 0
            for c in counters:
                (key, val) = c.split('=')
                if not counterStats[vName].has_key(key):
                    counterStats[vName][key] = 0
                counterStats[vName][key] += int(val)

            # Get start and end times.
            offset = line.find("startTime=")
            if offset == -1:
                logging.error("Could not find start time for " + vName)
            else:
                startTime = int(line[offset + 10: offset + 23])
                counterStats[vName]["startTime"] = min(
                    counterStats[vName]["startTime"], startTime)
            offset = line.find("finishTime=")
            if offset == -1:
                logging.error("Could not find end time for " + vName)
            else:
                finishTime = int(line[offset + 11: offset + 24])
                counterStats[vName]["finishTime"] = max(
                    counterStats[vName]["finishTime"], finishTime)

        # Look for exceptions.
        result = re.search(exceptionRe, line)
        if result != None:
            stats["nException"] += 1
            exception = result.group(1)
            vName = stats["vertexName"]
            if exceptions.has_key(vName):
                exceptions[vName][exception] = 1
            else:
                exceptions[vName] = {}
                exceptions[vName][exception] = 1

        # Look for non-zero exits.
        if line.find(nonzeroString) != -1:
            stats["nExit"] += 1

        # Look for DAG finished
        if line.find(dagFinishedString) != -1:
            # Capture the DAG start and end time.
            result = re.search("startTime=(\d+)", line)
            if result != None:
                dagStats["startTime"] = int(result.group(1))
            result = re.search("finishTime=(\d+)", line)
            if result != None:
                dagStats["finishTime"] = int(result.group(1))

    # Dump out the last container.
    printStats(stats, verbose)

    # Dump out global statistics.
    dumpGlobalStats(queryKey, globalStats, counterStats)

    # Dump out the counter stats.
    dumpCounterStats(queryKey, counterStats)

    # Compare times.
    dumpRuntimes(queryKey, globalStats, counterStats, dagStats)

    # Dump out exception info.
    dumpExceptionInfo(queryKey, exceptions)

    # Some key job statistics. Right now just intermediate data.
    print("\nOther Stats:")
    print("TotalIntermediateData")
    intermediateData = 0
    for vertex in globalStats.keys():
        if vertex[0:7] == "Reducer":
            intermediateData += globalStats[vertex]["totalBytes"]
    print(readable(intermediateData))


def dumpRuntimes(queryKey, globalStats, counterStats, dagStats):
    runTimes = []

    print("")
    for vertex in globalStats.keys():
        # Get runtime from the counter stats area.
        if counterStats.has_key(vertex):
            startTime = counterStats[vertex]["startTime"]
            finishTime = counterStats[vertex]["finishTime"]
            totalTime = finishTime - startTime
            runTimes.append(totalTime)
            print("%s Start %s Finish %s Total %f" % (
            vertex, toDateTime(startTime), toDateTime(finishTime),
            totalTime / 1000.0))

    totalVertexRuntime = sum(runTimes) / 1000.0
    dagStart = dagStats["startTime"]
    dagFinish = dagStats["finishTime"]
    dagRuntime = (dagStats["finishTime"] - dagStats["startTime"]) / 1000.0
    print("DAG Start %s Finish %s Total %f" % (
    toDateTime(dagStart), toDateTime(dagFinish), dagRuntime))
    print("Total Vertex Runtime = %fs" % totalVertexRuntime)


def toDateTime(timestamp):
    return datetime.fromtimestamp(float(timestamp) / 1000).strftime(
        "%Y-%m-%d %H:%M:%S")


def dumpExceptionInfo(queryKey, exceptions):
    print("\nPossible Errors:")
    print("QueryKey,Vertex,ListOfExceptions")
    for v in exceptions:
        vName = v
        if vName == None:
            vName = "AppMaster"
        print(queryKey, ",", vName, ",", end='', sep='')
        print(','.join(exceptions[v].keys()))


def dumpCounterStats(queryKey, counterStats):
    print("\nNotable Counter Stats:")
    importantCounterStats = ["DATA_LOCAL_TASKS", "RACK_LOCAL_TASKS",
                             "SPILLED_RECORDS", \
                             "WRONG_MAP", "WRONG_REDUCE", "WRONG_LENGTH",
                             "FAILED_SHUFFLE", \
                             "BAD_ID", "IO_ERROR"]
    print("QueryKey,Vertex", end='')
    for key in importantCounterStats:
        print(",", key, sep='', end='')
    print("")
    for vertex in counterStats.keys():
        print(queryKey, ",", vertex, sep='', end='')
        for key in importantCounterStats:
            if counterStats[vertex].has_key(key):
                print(",", counterStats[vertex][key], sep='', end='')
            else:
                print(",0", sep='', end='')
        print("")


def dumpGlobalStats(queryKey, globalStats, counterStats):
    print(
        "\nQueryKey,Vertex,TotalContainers,TotalBytesRead,TotalRecsRead,TotalBytesWrite,ReadHistCounts,ReadHistCenters,RunTimeSec")
    for vertex in globalStats.keys():
        # Compute histograms if data is available.
        logging.info("Compute histograms for " + vertex)
        counts = []
        centers = []
        if globalStats[vertex]["byteObservations"] != []:
            (counts, centers) = numpy.histogram(
                globalStats[vertex]["byteObservations"])
            counts = counts.tolist()
            centers = [readable(x) for x in centers.tolist()]

        # Get runtime from the counter stats area.
        runTime = -1000
        if counterStats.has_key(vertex):
            runTime = counterStats[vertex]["finishTime"] - counterStats[vertex][
                "startTime"]

        print(queryKey, ",", \
              vertex, ",", \
              globalStats[vertex]["totalContainers"], ",", \
              readable(globalStats[vertex]["totalBytes"]), ",", \
              globalStats[vertex]["totalRecs"], ",", \
              readable(globalStats[vertex]["totalBytesWrite"]), ",", \
              str(counts), ",", \
              str(centers), ",", \
              runTime / 1000.0, \
              sep='')


def readable(num):
    for x in ['bytes', 'KB', 'MB', 'GB', 'TB']:
        if num < 1024.0:
            return "%3.1f %s" % (num, x)
        num /= 1024.0


def resetStats(stats):
    stats["containerName"] = None
    stats["vertexName"] = None
    stats["nBytes"] = 0
    stats["nBytesWrite"] = 0
    stats["nRecs"] = 0
    stats["nException"] = 0
    stats["nExit"] = 0


def printStats(stats, verbose, queryKey="NONE"):
    if not verbose:
        return

    print(queryKey, ",", \
          stats["containerName"], ",", \
          stats["vertexName"], ",", \
          stats["nBytes"], ",", \
          stats["nRecs"], ",", \
          stats["nException"], ",", \
          stats["nExit"], sep='')


log = """
17/02/07 18:26:27 INFO log.PerfLogger: <PERFLOG method=compile from=org.apache.hadoop.hive.ql.Driver>
17/02/07 18:26:27 INFO log.PerfLogger: <PERFLOG method=parse from=org.apache.hadoop.hive.ql.Driver>
17/02/07 18:26:27 INFO parse.ParseDriver: Parsing command: SELECT count(*) FROM core_data.dim_users WHERE ds > '2017-01-30'
17/02/07 18:26:27 INFO parse.ParseDriver: Parse Completed
17/02/07 18:26:27 INFO log.PerfLogger: </PERFLOG method=parse start=1486491987321 end=1486491987321 duration=0 from=org.apache.hadoop.hive.ql.Driver>
17/02/07 18:26:27 INFO log.PerfLogger: <PERFLOG method=semanticAnalyze from=org.apache.hadoop.hive.ql.Driver>
17/02/07 18:26:27 INFO parse.SemanticAnalyzer: Starting Semantic Analysis
17/02/07 18:26:27 INFO parse.SemanticAnalyzer: Completed phase 1 of Semantic Analysis
17/02/07 18:26:27 INFO parse.SemanticAnalyzer: Get metadata for source tables
17/02/07 18:26:27 WARN conf.HiveConf: DEPRECATED: Configuration property hive.metastore.local no longer has any effect. Make sure to provide a valid value for hive.metastore.uris if you are connecting to a remote metastore.
17/02/07 18:26:27 INFO parse.SemanticAnalyzer: Get metadata for subqueries
17/02/07 18:26:27 INFO parse.SemanticAnalyzer: Get metadata for destination tables
17/02/07 18:26:27 INFO ql.Context: New scratch dir is hdfs://airfs-silver/tmp/hive-hive/hive_2017-02-07_18-26-27_321_3633275010402718008-500
17/02/07 18:26:27 INFO parse.SemanticAnalyzer: Completed getting MetaData in Semantic Analysis
17/02/07 18:26:27 INFO common.FileUtils: Creating directory if it doesn't exist: hdfs://airfs-silver/tmp/hive-hive/hive_2017-02-07_18-26-27_321_3633275010402718008-500/-mr-10000/.hive-staging_hive_2017-02-07_18-26-27_321_3633275010402718008-500
17/02/07 18:26:27 INFO parse.SemanticAnalyzer: Set stats collection dir : hdfs://airfs-silver/tmp/hive-hive/hive_2017-02-07_18-26-27_321_3633275010402718008-500/-mr-10000/.hive-staging_hive_2017-02-07_18-26-27_321_3633275010402718008-500/-ext-10002
17/02/07 18:26:27 INFO ppd.OpProcFactory: Processing for FS(2719089)
17/02/07 18:26:27 INFO ppd.OpProcFactory: Processing for SEL(2719088)
17/02/07 18:26:27 INFO ppd.OpProcFactory: Processing for GBY(2719087)
17/02/07 18:26:27 INFO ppd.OpProcFactory: Processing for RS(2719086)
17/02/07 18:26:27 INFO ppd.OpProcFactory: Processing for GBY(2719085)
17/02/07 18:26:27 INFO ppd.OpProcFactory: Processing for SEL(2719084)
17/02/07 18:26:27 INFO ppd.OpProcFactory: Processing for FIL(2719083)
17/02/07 18:26:27 INFO ppd.OpProcFactory: Pushdown Predicates of FIL For Alias : dim_users
17/02/07 18:26:27 INFO ppd.OpProcFactory: \t(ds > '2017-01-30')
17/02/07 18:26:27 INFO ppd.OpProcFactory: Processing for TS(2719082)
17/02/07 18:26:27 INFO ppd.OpProcFactory: Pushdown Predicates of TS For Alias : dim_users
17/02/07 18:26:27 INFO ppd.OpProcFactory: \t(ds > '2017-01-30')
17/02/07 18:26:27 INFO log.PerfLogger: <PERFLOG method=partition-retrieving from=org.apache.hadoop.hive.ql.optimizer.ppr.PartitionPruner>
17/02/07 18:26:27 INFO log.PerfLogger: </PERFLOG method=partition-retrieving start=1486491987456 end=1486491987665 duration=209 from=org.apache.hadoop.hive.ql.optimizer.ppr.PartitionPruner>
17/02/07 18:26:27 INFO optimizer.ColumnPrunerProcFactory: RS 2719086 oldColExprMap: {VALUE._col0=Column[_col0]}
17/02/07 18:26:27 INFO optimizer.ColumnPrunerProcFactory: RS 2719086 newColExprMap: {VALUE._col0=Column[_col0]}
17/02/07 18:26:27 INFO physical.MetadataOnlyOptimizer: Looking for table scans where optimization is applicable
17/02/07 18:26:27 INFO physical.MetadataOnlyOptimizer: Found 0 metadata only table scans
17/02/07 18:26:27 INFO parse.SemanticAnalyzer: Completed plan generation
17/02/07 18:26:27 INFO ql.Driver: Semantic Analysis Completed
17/02/07 18:26:27 INFO log.PerfLogger: </PERFLOG method=semanticAnalyze start=1486491987321 end=1486491987667 duration=346 from=org.apache.hadoop.hive.ql.Driver>
17/02/07 18:26:27 INFO exec.ListSinkOperator: Initializing Self OP[2719091]
17/02/07 18:26:27 INFO exec.ListSinkOperator: Operator 2719091 OP initialized
17/02/07 18:26:27 INFO exec.ListSinkOperator: Initialization Done 2719091 OP
17/02/07 18:26:27 INFO ql.Driver: Returning Hive schema: Schema(fieldSchemas:[FieldSchema(name:_c0, type:bigint, comment:null)], properties:null)
17/02/07 18:26:27 INFO log.PerfLogger: </PERFLOG method=compile start=1486491987321 end=1486491987668 duration=347 from=org.apache.hadoop.hive.ql.Driver>
17/02/07 18:26:27 INFO log.PerfLogger: <PERFLOG method=Driver.run from=org.apache.hadoop.hive.ql.Driver>
17/02/07 18:26:27 INFO log.PerfLogger: <PERFLOG method=TimeToSubmit from=org.apache.hadoop.hive.ql.Driver>
17/02/07 18:26:27 INFO ql.Driver: Concurrency mode is disabled, not creating a lock manager
17/02/07 18:26:27 INFO log.PerfLogger: <PERFLOG method=Driver.execute from=org.apache.hadoop.hive.ql.Driver>
17/02/07 18:26:27 INFO ql.Driver: Starting command: SELECT count(*) FROM core_data.dim_users WHERE ds > '2017-01-30'
17/02/07 18:26:27 INFO ql.Driver: Total jobs = 1
17/02/07 18:26:27 INFO log.PerfLogger: </PERFLOG method=TimeToSubmit start=1486491987668 end=1486491987668 duration=0 from=org.apache.hadoop.hive.ql.Driver>
17/02/07 18:26:27 INFO log.PerfLogger: <PERFLOG method=runTasks from=org.apache.hadoop.hive.ql.Driver>
17/02/07 18:26:27 INFO log.PerfLogger: <PERFLOG method=task.MAPRED.Stage-1 from=org.apache.hadoop.hive.ql.Driver>
17/02/07 18:26:27 INFO ql.Driver: Launching Job 1 out of 1
17/02/07 18:26:27 INFO exec.Task: Number of reduce tasks determined at compile time: 1
17/02/07 18:26:27 INFO exec.Task: In order to change the average load for a reducer (in bytes):
17/02/07 18:26:27 INFO exec.Task:   set hive.exec.reducers.bytes.per.reducer=<number>
17/02/07 18:26:27 INFO exec.Task: In order to limit the maximum number of reducers:
17/02/07 18:26:27 INFO exec.Task:   set hive.exec.reducers.max=<number>
17/02/07 18:26:27 INFO exec.Task: In order to set a constant number of reducers:
17/02/07 18:26:27 INFO exec.Task:   set mapreduce.job.reduces=<number>
17/02/07 18:26:27 INFO ql.Context: New scratch dir is hdfs://airfs-silver/tmp/hive-hive/hive_2017-02-07_18-26-27_321_3633275010402718008-19877
17/02/07 18:26:27 INFO mr.ExecDriver: Using org.apache.hadoop.hive.ql.io.CombineHiveInputFormat
17/02/07 18:26:27 INFO mr.ExecDriver: adding libjars: file:///srv/hive/lib//airbnb-hive-hooks-2.0.1.jar,file:///srv/hive/lib//airbnb-internal-hooks-1.0.1-all.jar,file:///srv/hive/lib//airbnb-reair-hive-hooks-1.0.0.jar,file:///srv/hive/lib//brickhouse-0.7.1-SNAPSHOT.jar,file:///srv/hive/lib//csv-serde-0.10.0.jar,file:///srv/hive/lib//geoip-udf-1.0.jar,file:///srv/hive/lib//hadoop-goodies-all.jar,file:///srv/hive/lib//joda-time-2.1.jar,file:///srv/hive/lib//jsonserde-0.1.jar,file:///srv/hive/lib//json-serde-1.3-jar-with-dependencies.jar,file:///srv/hive/lib//librarian-udf-0.0.1-jar-with-dependencies.jar,file:///srv/hive/lib//nexr-hive-udf-0.2-SNAPSHOT.jar,file:///srv/hive/lib//Rank.jar,file:///srv/hive/lib//sort_array.jar,file:///srv/hive/lib//user-agent-udf-1.0.1.jar
17/02/07 18:26:27 INFO exec.Utilities: Processing alias dim_users
17/02/07 18:26:27 INFO exec.Utilities: Adding input file hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-01-31
17/02/07 18:26:27 INFO exec.Utilities: Content Summary not cached for hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-01-31
17/02/07 18:26:27 INFO exec.Utilities: Adding input file hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-01
17/02/07 18:26:27 INFO exec.Utilities: Content Summary not cached for hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-01
17/02/07 18:26:27 INFO exec.Utilities: Adding input file hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-02
17/02/07 18:26:27 INFO exec.Utilities: Content Summary not cached for hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-02
17/02/07 18:26:27 INFO exec.Utilities: Adding input file hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-03
17/02/07 18:26:27 INFO exec.Utilities: Content Summary not cached for hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-03
17/02/07 18:26:27 INFO exec.Utilities: Adding input file hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-04
17/02/07 18:26:27 INFO exec.Utilities: Content Summary not cached for hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-04
17/02/07 18:26:27 INFO exec.Utilities: Adding input file hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-05
17/02/07 18:26:27 INFO exec.Utilities: Content Summary not cached for hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-05
17/02/07 18:26:27 INFO ql.Context: New scratch dir is hdfs://airfs-silver/tmp/hive-hive/hive_2017-02-07_18-26-27_321_3633275010402718008-19877
17/02/07 18:26:27 INFO log.PerfLogger: <PERFLOG method=serializePlan from=org.apache.hadoop.hive.ql.exec.Utilities>
17/02/07 18:26:27 INFO exec.Utilities: Serializing MapWork via kryo
17/02/07 18:26:27 INFO log.PerfLogger: </PERFLOG method=serializePlan start=1486491987886 end=1486491987933 duration=47 from=org.apache.hadoop.hive.ql.exec.Utilities>
17/02/07 18:26:27 INFO log.PerfLogger: <PERFLOG method=serializePlan from=org.apache.hadoop.hive.ql.exec.Utilities>
17/02/07 18:26:27 INFO exec.Utilities: Serializing ReduceWork via kryo
17/02/07 18:26:28 INFO log.PerfLogger: </PERFLOG method=serializePlan start=1486491987938 end=1486491988124 duration=186 from=org.apache.hadoop.hive.ql.exec.Utilities>
17/02/07 18:26:28 INFO client.ConfiguredRMFailoverProxyProvider: Failing over to rm1373
17/02/07 18:26:28 WARN mapreduce.JobSubmitter: Hadoop command-line option parsing not performed. Implement the Tool interface and execute your application with ToolRunner to remedy this.
17/02/07 18:26:57 INFO log.PerfLogger: <PERFLOG method=getSplits from=org.apache.hadoop.hive.ql.io.CombineHiveInputFormat>
17/02/07 18:26:57 INFO io.CombineHiveInputFormat: CombineHiveInputSplit creating pool for hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-01-31; using filter path hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-01-31
17/02/07 18:26:57 INFO io.CombineHiveInputFormat: CombineHiveInputSplit: pool is already created for hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-01; using filter path hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-01
17/02/07 18:26:57 INFO io.CombineHiveInputFormat: CombineHiveInputSplit: pool is already created for hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-02; using filter path hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-02
17/02/07 18:26:57 INFO io.CombineHiveInputFormat: CombineHiveInputSplit: pool is already created for hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-03; using filter path hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-03
17/02/07 18:26:57 INFO io.CombineHiveInputFormat: CombineHiveInputSplit: pool is already created for hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-04; using filter path hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-04
17/02/07 18:26:57 INFO io.CombineHiveInputFormat: CombineHiveInputSplit: pool is already created for hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-05; using filter path hdfs://airfs-silver/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-05
17/02/07 18:26:57 INFO input.FileInputFormat: Total input paths to process : 1427
17/02/07 18:26:57 INFO input.CombineFileInputFormat: DEBUG: Terminated node allocation with : CompletedNodes: 601, size left: 47662083
17/02/07 18:26:58 INFO io.CombineHiveInputFormat: number of splits 438
17/02/07 18:26:58 INFO log.PerfLogger: </PERFLOG method=getSplits start=1486492017446 end=1486492018495 duration=1049 from=org.apache.hadoop.hive.ql.io.CombineHiveInputFormat>
17/02/07 18:26:58 WARN split.JobSplitWriter: Max block location exceeded for split: Paths:/user/hive/warehouse/core_data.db/dim_users/ds=2017-02-05/000216_0:0+47662083 Locations:i-4e6fb6d4.inst.aws.airbnb.com:i-a133c05f.inst.aws.airbnb.com:i-a3e8e93b.inst.aws.airbnb.com:i-3eb00c9e.inst.aws.airbnb.com:i-2c03ceb7.inst.aws.airbnb.com:i-8a4a5a19.inst.aws.airbnb.com:i-f148990e.inst.aws.airbnb.com:i-c5657a75.inst.aws.airbnb.com:i-0e03ce95.inst.aws.airbnb.com:i-0d9434f3.inst.aws.airbnb.com:i-fdb7696d.inst.aws.airbnb.com:i-f6aeb66e.inst.aws.airbnb.com:i-27b6e8d8.inst.aws.airbnb.com:i-0403ce9f.inst.aws.airbnb.com:i-8e1c0916.inst.aws.airbnb.com:i-63964fd3.inst.aws.airbnb.com:i-42886fd1.inst.aws.airbnb.com:i-e8489917.inst.aws.airbnb.com:i-0c4b5b9f.inst.aws.airbnb.com:i-89e2551a.inst.aws.airbnb.com:i-fe657a4e.inst.aws.airbnb.com:i-9ff7a904.inst.aws.airbnb.com:i-e1b76971.inst.aws.airbnb.com:i-51ea74cb.inst.aws.airbnb.com:i-0cc6d95be031251a9.inst.aws.airbnb.com:i-88e87612.inst.aws.airbnb.com:i-f7657a47.inst.aws.airbnb.com:i-cc657a7c.inst.aws.airbnb.com:i-b681bd25.inst.aws.airbnb.com:i-47ea74dd.inst.aws.airbnb.com:i-407857e0.inst.aws.airbnb.com:i-3a4b5ba9.inst.aws.airbnb.com:i-b663df16.inst.aws.airbnb.com:i-042ecfca5e87ef3ce.inst.aws.airbnb.com:i-e95ce049.inst.aws.airbnb.com:i-044b5b97.inst.aws.airbnb.com:i-0203ce99.inst.aws.airbnb.com:i-09a37efe3d1002fa6.inst.aws.airbnb.com:i-009e37b8b53554027.inst.aws.airbnb.com:i-818dca32.inst.aws.airbnb.com:i-934a5a00.inst.aws.airbnb.com:i-a0775800.inst.aws.airbnb.com:i-ab2f6431.inst.aws.airbnb.com:i-b881bd2b.inst.aws.airbnb.com:i-66f4aafd.inst.aws.airbnb.com:i-a9b76939.inst.aws.airbnb.com:i-cdb7695d.inst.aws.airbnb.com:i-f6657a46.inst.aws.airbnb.com:i-93306808.inst.aws.airbnb.com:i-7445928b.inst.aws.airbnb.com:i-55fa28aa.inst.aws.airbnb.com:i-e2b76972.inst.aws.airbnb.com:i-de8a5a21.inst.aws.airbnb.com:i-8be25518.inst.aws.airbnb.com:i-77ea74ed.inst.aws.airbnb.com:i-08f9c4e152dede3c4.inst.aws.airbnb.com:i-384b5bab.inst.aws.airbnb.com:i-c6657a76.inst.aws.airbnb.com:i-ae00d351.inst.aws.airbnb.com:i-fd657a4d.inst.aws.airbnb.com:i-844a5a17.inst.aws.airbnb.com:i-314b5ba2.inst.aws.airbnb.com:i-04383139450753621.inst.aws.airbnb.com:i-2ecad09f.inst.aws.airbnb.com:i-cb657a7b.inst.aws.airbnb.com:i-024b5b91.inst.aws.airbnb.com:i-b0b76920.inst.aws.airbnb.com:i-21883581.inst.aws.airbnb.com:i-f4b76964.inst.aws.airbnb.com:i-1678ce8d.inst.aws.airbnb.com:i-64964fd4.inst.aws.airbnb.com:i-6545929a.inst.aws.airbnb.com:i-f7b76967.inst.aws.airbnb.com:i-43eb56d8.inst.aws.airbnb.com:i-3708e8a4.inst.aws.airbnb.com:i-feb7696e.inst.aws.airbnb.com:i-99f7a902.inst.aws.airbnb.com:i-4f6fb6d5.inst.aws.airbnb.com:i-aac31355.inst.aws.airbnb.com:i-456fb6df.inst.aws.airbnb.com:i-41a5da57.inst.aws.airbnb.com:i-c46c0d5c.inst.aws.airbnb.com:i-7b3e7ac8.inst.aws.airbnb.com:i-3508e8a6.inst.aws.airbnb.com:i-9cf7a907.inst.aws.airbnb.com:i-962f640c.inst.aws.airbnb.com:i-ac00d353.inst.aws.airbnb.com:i-9581bd06.inst.aws.airbnb.com:i-7503ceee.inst.aws.airbnb.com:i-436a1a55.inst.aws.airbnb.com:i-864a5a15.inst.aws.airbnb.com:i-bab7692a.inst.aws.airbnb.com:i-0e9eb518.inst.aws.airbnb.com:i-cab7695a.inst.aws.airbnb.com:i-b2b76922.inst.aws.airbnb.com:i-afc31350.inst.aws.airbnb.com:i-6be28dd8.inst.aws.airbnb.com:i-9430680f.inst.aws.airbnb.com:i-9d81bd0e.inst.aws.airbnb.com:i-1f2998bf.inst.aws.airbnb.com:i-6eea74f4.inst.aws.airbnb.com:i-f6b76966.inst.aws.airbnb.com:i-0b8b0922af3025ad5.inst.aws.airbnb.com:i-fcb7696c.inst.aws.airbnb.com:i-7aea74e0.inst.aws.airbnb.com:i-9e81bd0d.inst.aws.airbnb.com:i-24b6e8db.inst.aws.airbnb.com:i-252cafda.inst.aws.airbnb.com:i-2a78ceb1.inst.aws.airbnb.com:i-adc31352.inst.aws.airbnb.com:i-aeb7693e.inst.aws.airbnb.com:i-c4657a74.inst.aws.airbnb.com:i-2b78ceb0.inst.aws.airbnb.com:i-972f640d.inst.aws.airbnb.com:i-ff657a4f.inst.aws.airbnb.com:i-293fccd7.inst.aws.airbnb.com:i-f5b76965.inst.aws.airbnb.com:i-f8657a48.inst.aws.airbnb.com:i-42a5da54.inst.aws.airbnb.com:i-21b6e8de.inst.aws.airbnb.com:i-9a306801.inst.aws.airbnb.com:i-cbb7695b.inst.aws.airbnb.com:i-04575e03e046f8a21.inst.aws.airbnb.com:i-afb7693f.inst.aws.airbnb.com:i-8fe2551c.inst.aws.airbnb.com:i-d48a5a2b.inst.aws.airbnb.com:i-b763df17.inst.aws.airbnb.com:i-3fcb8f8c.inst.aws.airbnb.com:i-7b459284.inst.aws.airbnb.com:i-5cfa28a3.inst.aws.airbnb.com:i-534592ac.inst.aws.airbnb.com:i-c3657a73.inst.aws.airbnb.com:i-c3b76953.inst.aws.airbnb.com:i-b1b76921.inst.aws.airbnb.com:i-544592ab.inst.aws.airbnb.com:i-24cad095.inst.aws.airbnb.com:i-61f4aafa.inst.aws.airbnb.com:i-a7b76937.inst.aws.airbnb.com:i-6fea74f5.inst.aws.airbnb.com:i-50fa28af.inst.aws.airbnb.com:i-fab7696a.inst.aws.airbnb.com:i-b481bd27.inst.aws.airbnb.com:i-af00d350.inst.aws.airbnb.com:i-374b5ba4.inst.aws.airbnb.com:i-0d9eb51b.inst.aws.airbnb.com:i-0603ce9d.inst.aws.airbnb.com:i-6dea74f7.inst.aws.airbnb.com:i-2b4959b8.inst.aws.airbnb.com:i-43ea74d9.inst.aws.airbnb.com:i-324b5ba1.inst.aws.airbnb.com:i-c48c7374.inst.aws.airbnb.com:i-466fb6dc.inst.aws.airbnb.com:i-0cf07f42a92b5b970.inst.aws.airbnb.com:i-63e5c2cf.inst.aws.airbnb.com:i-1d1a478d.inst.aws.airbnb.com:i-014b5b92.inst.aws.airbnb.com:i-bcb7692c.inst.aws.airbnb.com:i-3f4b5bac.inst.aws.airbnb.com:i-f348990c.inst.aws.airbnb.com:i-dbf7a940.inst.aws.airbnb.com:i-a2775802.inst.aws.airbnb.com:i-d7657a67.inst.aws.airbnb.com:i-cab10d6a.inst.aws.airbnb.com:i-a0b76930.inst.aws.airbnb.com:i-54ea74ce.inst.aws.airbnb.com:i-c08b1073.inst.aws.airbnb.com:i-c8b76958.inst.aws.airbnb.com:i-ee489911.inst.aws.airbnb.com:i-0a5b29969ea546080.inst.aws.airbnb.com:i-a6b76936.inst.aws.airbnb.com:i-76e3b1e6.inst.aws.airbnb.com:i-21cad090.inst.aws.airbnb.com:i-964a5a05.inst.aws.airbnb.com:i-cfb7695f.inst.aws.airbnb.com:i-3408e8a7.inst.aws.airbnb.com:i-9df7a906.inst.aws.airbnb.com:i-adb7693d.inst.aws.airbnb.com:i-2acad09b.inst.aws.airbnb.com:i-d98c7369.inst.aws.airbnb.com:i-66ea74fc.inst.aws.airbnb.com:i-7b6fb6e1.inst.aws.airbnb.com:i-9e306805.inst.aws.airbnb.com:i-8ce87616.inst.aws.airbnb.com:i-b5b76925.inst.aws.airbnb.com:i-824a5a11.inst.aws.airbnb.com:i-f3b76963.inst.aws.airbnb.com:i-099eb51f.inst.aws.airbnb.com:i-77e3b1e7.inst.aws.airbnb.com:i-055aef07fe9ea4042.inst.aws.airbnb.com:i-c423685e.inst.aws.airbnb.com:i-814a5a12.inst.aws.airbnb.com:i-9e4a5a0d.inst.aws.airbnb.com:i-c7b76957.inst.aws.airbnb.com:i-b9b76929.inst.aws.airbnb.com:i-9d4a5a0e.inst.aws.airbnb.com:i-0cbe64803caf1c997.inst.aws.airbnb.com:i-0303ce98.inst.aws.airbnb.com:i-4d6fb6d7.inst.aws.airbnb.com:i-914a5a02.inst.aws.airbnb.com:i-ceb7695e.inst.aws.airbnb.com:i-67ea74fd.inst.aws.airbnb.com:i-acb7693c.inst.aws.airbnb.com:i-7fe3b1ef.inst.aws.airbnb.com:i-b4b76924.inst.aws.airbnb.com:i-0908e89a.inst.aws.airbnb.com:i-4aea74d0.inst.aws.airbnb.com:i-786fb6e2.inst.aws.airbnb.com:i-f2b76962.inst.aws.airbnb.com:i-51b6e8ae.inst.aws.airbnb.com:i-75ea74ef.inst.aws.airbnb.com:i-192cafe6.inst.aws.airbnb.com:i-db8a5a24.inst.aws.airbnb.com:i-f1b76961.inst.aws.airbnb.com:i-3c4b5baf.inst.aws.airbnb.com:i-a4b76934.inst.aws.airbnb.com:i-f248990d.inst.aws.airbnb.com:i-50ea74ca.inst.aws.airbnb.com:i-ccb10d6c.inst.aws.airbnb.com:i-954a5a06.inst.aws.airbnb.com:i-61964fd1.inst.aws.airbnb.com:i-30cb8f83.inst.aws.airbnb.com:i-089eb51e.inst.aws.airbnb.com:i-364b5ba5.inst.aws.airbnb.com:i-cd8c737d.inst.aws.airbnb.com:i-3e4b5bad.inst.aws.airbnb.com:i-d2657a62.inst.aws.airbnb.com:i-06f0d7a26ac269325.inst.aws.airbnb.com:i-6f459290.inst.aws.airbnb.com:i-0e26fded98eb46459.inst.aws.airbnb.com:i-4bea74d1.inst.aws.airbnb.com:i-b6b76926.inst.aws.airbnb.com:i-88e2551b.inst.aws.airbnb.com:i-6be3b1fb.inst.aws.airbnb.com:i-7a6fb6e0.inst.aws.airbnb.com:i-904a5a03.inst.aws.airbnb.com:i-c88a5a37.inst.aws.airbnb.com:i-6ee3b1fe.inst.aws.airbnb.com:i-c68c7376.inst.aws.airbnb.com:i-2c2cafd3.inst.aws.airbnb.com:i-b8b76928.inst.aws.airbnb.com:i-7409af8b.inst.aws.airbnb.com:i-bdb7692d.inst.aws.airbnb.com:i-9c306807.inst.aws.airbnb.com:i-4cea74d6.inst.aws.airbnb.com:i-974a5a04.inst.aws.airbnb.com:i-884a5a1b.inst.aws.airbnb.com:i-9af7a901.inst.aws.airbnb.com:i-ce8c737e.inst.aws.airbnb.com:i-159eb503.inst.aws.airbnb.com:i-894a5a1a.inst.aws.airbnb.com:i-0709b7bfb3821344b.inst.aws.airbnb.com:i-beb7692e.inst.aws.airbnb.com:i-7c3e7acf.inst.aws.airbnb.com:i-7903cee2.inst.aws.airbnb.com:i-097684574c41e3b5e.inst.aws.airbnb.com:i-f0b76960.inst.aws.airbnb.com:i-179eb501.inst.aws.airbnb.com:i-c68a5a39.inst.aws.airbnb.com:i-a900d356.inst.aws.airbnb.com:i-6de3b1fd.inst.aws.airbnb.com:i-7ae5c2d6.inst.aws.airbnb.com:i-ffb10d5f.inst.aws.airbnb.com:i-a2b76932.inst.aws.airbnb.com:i-e483a274.inst.aws.airbnb.com:i-344b5ba7.inst.aws.airbnb.com:i-b081bd23.inst.aws.airbnb.com:i-434592bc.inst.aws.airbnb.com:i-85bd6d7a.inst.aws.airbnb.com:i-406fb6da.inst.aws.airbnb.com:i-e85ce048.inst.aws.airbnb.com:i-00d987179a6260504.inst.aws.airbnb.com:i-0b86da6dce4a77d09.inst.aws.airbnb.com:i-cf8c737f.inst.aws.airbnb.com:i-004c68a3362b75125.inst.aws.airbnb.com:i-b181bd22.inst.aws.airbnb.com:i-234b5bb0.inst.aws.airbnb.com:i-67e5c2cb.inst.aws.airbnb.com:i-6ce3b1fc.inst.aws.airbnb.com:i-f048990f.inst.aws.airbnb.com:i-a1b76931.inst.aws.airbnb.com:i-b281bd21.inst.aws.airbnb.com:i-414592be.inst.aws.airbnb.com:i-182cafe7.inst.aws.airbnb.com:i-9bf7a900.inst.aws.airbnb.com:i-0c318a9fd6d355546.inst.aws.airbnb.com:i-b381bd20.inst.aws.airbnb.com:i-424592bd.inst.aws.airbnb.com:i-c9b76959.inst.aws.airbnb.com:i-01c885c490f0ef4d1.inst.aws.airbnb.com:i-304b5ba3.inst.aws.airbnb.com:i-0d617573eebf6e397.inst.aws.airbnb.com:i-9c6d423c.inst.aws.airbnb.com:i-79ea74e3.inst.aws.airbnb.com:i-944a5a07.inst.aws.airbnb.com:i-68e28ddb.inst.aws.airbnb.com:i-034b5b90.inst.aws.airbnb.com:i-da8a5a25.inst.aws.airbnb.com:i-169eb500.inst.aws.airbnb.com:i-9481bd07.inst.aws.airbnb.com:i-3d4b5bae.inst.aws.airbnb.com:i-9a8dca29.inst.aws.airbnb.com:i-02336fe23043b1b74.inst.aws.airbnb.com:i-f548990a.inst.aws.airbnb.com:i-2e78ceb5.inst.aws.airbnb.com:i-56ea74cc.inst.aws.airbnb.com:i-354b5ba6.inst.aws.airbnb.com:i-1578ce8e.inst.aws.airbnb.com:i-bfb7692f.inst.aws.airbnb.com:i-0dfb2d36d1bf6eccd.inst.aws.airbnb.com:i-c78a5a38.inst.aws.airbnb.com:i-e7b76977.inst.aws.airbnb.com:i-0e05850807e5962f4.inst.aws.airbnb.com:i-c18c7371.inst.aws.airbnb.com:i-7a3e7ac9.inst.aws.airbnb.com:i-3608e8a5.inst.aws.airbnb.com:i-0009da7c31544b171.inst.aws.airbnb.com:i-a3b76933.inst.aws.airbnb.com:i-0decd13f0f4562dfb.inst.aws.airbnb.com:i-a5775805.inst.aws.airbnb.com:i-ff489900.inst.aws.airbnb.com:i-d4657a64.inst.aws.airbnb.com:i-00bb3d956663aeccb.inst.aws.airbnb.com:i-854a5a16.inst.aws.airbnb.com:i-eeb7697e.inst.aws.airbnb.com:i-079ddeb4a5a77efe1.inst.aws.airbnb.com:i-9f81bd0c.inst.aws.airbnb.com:i-0b81c2f3289a4d55d.inst.aws.airbnb.com:i-59fbbeea.inst.aws.airbnb.com:i-f1657a41.inst.aws.airbnb.com:i-0a15dfc2760c00492.inst.aws.airbnb.com:i-7403ceef.inst.aws.airbnb.com:i-8db7691d.inst.aws.airbnb.com:i-73e3b1e3.inst.aws.airbnb.com:i-26883586.inst.aws.airbnb.com:i-834a5a10.inst.aws.airbnb.com:i-7703ceec.inst.aws.airbnb.com:i-efb7697f.inst.aws.airbnb.com:i-9f4a5a0c.inst.aws.airbnb.com:i-054b5b96.inst.aws.airbnb.com:i-c0657a70.inst.aws.airbnb.com:i-1e2cafe1.inst.aws.airbnb.com:i-20cad091.inst.aws.airbnb.com:i-7a09af85.inst.aws.airbnb.com:i-1357b681.inst.aws.airbnb.com:i-924a5a01.inst.aws.airbnb.com:i-74ea74ee.inst.aws.airbnb.com:i-804a5a13.inst.aws.airbnb.com:i-41eb56da.inst.aws.airbnb.com:i-abb7693b.inst.aws.airbnb.com:i-b981bd2a.inst.aws.airbnb.com:i-bcea5727.inst.aws.airbnb.com:i-8ff7a914.inst.aws.airbnb.com:i-9c4a5a0f.inst.aws.airbnb.com:i-f0657a40.inst.aws.airbnb.com:i-6af4aaf1.inst.aws.airbnb.com:i-0646b5abc43d7bc80.inst.aws.airbnb.com:i-01ef2fda2c11e316c.inst.aws.airbnb.com:i-2278ceb9.inst.aws.airbnb.com:i-c0b76950.inst.aws.airbnb.com:i-0808e89b.inst.aws.airbnb.com:i-92f7a909.inst.aws.airbnb.com:i-0f7fb75b166b8dfb6.inst.aws.airbnb.com:i-dd8a5a22.inst.aws.airbnb.com:i-78ea74e2.inst.aws.airbnb.com:i-03de787f728e15d1f.inst.aws.airbnb.com:i-9c8dca2f.inst.aws.airbnb.com:i-c55ce065.inst.aws.airbnb.com:i-e8b76978.inst.aws.airbnb.com:i-783e7acb.inst.aws.airbnb.com:i-02441f4627bb078cc.inst.aws.airbnb.com:i-eb489914.inst.aws.airbnb.com:i-0668bfbe25847759b.inst.aws.airbnb.com:i-51fa28ae.inst.aws.airbnb.com:i-162899b6.inst.aws.airbnb.com:i-192899b9.inst.aws.airbnb.com:i-72e3b1e2.inst.aws.airbnb.com:i-8b4a5a18.inst.aws.airbnb.com:i-334b5ba0.inst.aws.airbnb.com:i-0beae7e7492ea7aac.inst.aws.airbnb.com:i-c45ce064.inst.aws.airbnb.com:i-063543b0323c1f68a.inst.aws.airbnb.com:i-1b2cafe4.inst.aws.airbnb.com:i-942f640e.inst.aws.airbnb.com:i-9781bd04.inst.aws.airbnb.com:i-0c9eb51a.inst.aws.airbnb.com:i-00624cf44e22963c3.inst.aws.airbnb.com:i-d98a5a26.inst.aws.airbnb.com:i-878dca34.inst.aws.airbnb.com:i-c38c7373.inst.aws.airbnb.com:i-b781bd24.inst.aws.airbnb.com:i-43886fd0.inst.aws.airbnb.com:i-6e964fde.inst.aws.airbnb.com:i-808dca33.inst.aws.airbnb.com:i-202cafdf.inst.aws.airbnb.com:i-0b0eb5289c1995f59.inst.aws.airbnb.com:i-cb8c737b.inst.aws.airbnb.com:i-41886fd2.inst.aws.airbnb.com:i-a0895010.inst.aws.airbnb.com:i-69e3b1f9.inst.aws.airbnb.com:i-b581bd26.inst.aws.airbnb.com:i-74e3b1e4.inst.aws.airbnb.com:i-284959bb.inst.aws.airbnb.com:i-d88c7368.inst.aws.airbnb.com:i-49ea74d3.inst.aws.airbnb.com:i-57ea74cd.inst.aws.airbnb.com:i-0f8fb7ee99703b187.inst.aws.airbnb.com:i-5dfbbeee.inst.aws.airbnb.com:i-994a5a0a.inst.aws.airbnb.com:i-8fb7691f.inst.aws.airbnb.com:i-42ea74d8.inst.aws.airbnb.com:i-5c886fcf.inst.aws.airbnb.com:i-294959ba.inst.aws.airbnb.com:i-01f278c6a86a1106d.inst.aws.airbnb.com:i-5ffbbeec.inst.aws.airbnb.com:i-cf8b107c.inst.aws.airbnb.com:i-a3775803.inst.aws.airbnb.com:i-73ea74e9.inst.aws.airbnb.com:i-504592af.inst.aws.airbnb.com:i-6cea74f6.inst.aws.airbnb.com:i-9c81bd0f.inst.aws.airbnb.com:i-0a418d817938d4cb3.inst.aws.airbnb.com:i-004b5b93.inst.aws.airbnb.com:i-3dcb8f8e.inst.aws.airbnb.com:i-5efa28a1.inst.aws.airbnb.com:i-262cafd9.inst.aws.airbnb.com:i-8ee2551d.inst.aws.airbnb.com:i-ca8c737a.inst.aws.airbnb.com:i-60f4aafb.inst.aws.airbnb.com:i-447857e4.inst.aws.airbnb.com:i-0dbce3cd4702a2f2a.inst.aws.airbnb.com:i-564592a9.inst.aws.airbnb.com:i-25cad094.inst.aws.airbnb.com:i-63f4aaf8.inst.aws.airbnb.com:i-86e25515.inst.aws.airbnb.com:i-40ea74da.inst.aws.airbnb.com:i-984a5a0b.inst.aws.airbnb.com:i-0b9eb51d.inst.aws.airbnb.com:i-c28c7372.inst.aws.airbnb.com:i-22b6e8dd.inst.aws.airbnb.com:i-5f886fcc.inst.aws.airbnb.com:i-2c78ceb7.inst.aws.airbnb.com:i-0e0eeaec8de61c1b1.inst.aws.airbnb.com:i-a1e25532.inst.aws.airbnb.com:i-1778ce8c.inst.aws.airbnb.com:i-6fe28ddc.inst.aws.airbnb.com:i-40a5da56.inst.aws.airbnb.com:i-0103ce9a.inst.aws.airbnb.com:i-a1895011.inst.aws.airbnb.com:i-8ce2551f.inst.aws.airbnb.com:i-7809af87.inst.aws.airbnb.com:i-7d6fb6e7.inst.aws.airbnb.com:i-05ff2bc73fab61956.inst.aws.airbnb.com:i-6d964fdd.inst.aws.airbnb.com:i-3bcb8f88.inst.aws.airbnb.com:i-4b6fb6d1.inst.aws.airbnb.com:i-0e4b5b9d.inst.aws.airbnb.com:i-08031bdc2aa7c1222.inst.aws.airbnb.com:i-fd489902.inst.aws.airbnb.com:i-71ea74eb.inst.aws.airbnb.com:i-035294dd779d09cdb.inst.aws.airbnb.com:i-874a5a14.inst.aws.airbnb.com:i-70e3b1e0.inst.aws.airbnb.com:i-0b3a35f918750c5b4.inst.aws.airbnb.com:i-7bea74e1.inst.aws.airbnb.com:i-122cafed.inst.aws.airbnb.com:i-0576000cf531e3949.inst.aws.airbnb.com:i-ebb7697b.inst.aws.airbnb.com:i-e4b76974.inst.aws.airbnb.com:i-13cad0a2.inst.aws.airbnb.com:i-c2b76952.inst.aws.airbnb.com:i-01773cb64e60331f8.inst.aws.airbnb.com:i-fb657a4b.inst.aws.airbnb.com:i-db8c736b.inst.aws.airbnb.com:i-40886fd3.inst.aws.airbnb.com:i-0979c015056eacc3e.inst.aws.airbnb.com:i-65e5c2c9.inst.aws.airbnb.com:i-9681bd05.inst.aws.airbnb.com:i-cf657a7f.inst.aws.airbnb.com:i-437857e3.inst.aws.airbnb.com:i-e3b76973.inst.aws.airbnb.com:i-0720bd5b8928e4853.inst.aws.airbnb.com:i-a233c05c.inst.aws.airbnb.com:i-f9b76969.inst.aws.airbnb.com:i-828dca31.inst.aws.airbnb.com:i-af89501f.inst.aws.airbnb.com:i-5a4592a5.inst.aws.airbnb.com:i-0cd688f7b931d04ad.inst.aws.airbnb.com:i-70ea74ea.inst.aws.airbnb.com:i-7b09af84.inst.aws.airbnb.com:i-68ea74f2.inst.aws.airbnb.com:i-9e8dca2d.inst.aws.airbnb.com:i-ffb7696f.inst.aws.airbnb.com:i-64e5c2c8.inst.aws.airbnb.com:i-e9b76979.inst.aws.airbnb.com:i-78459287.inst.aws.airbnb.com:i-bdea5726.inst.aws.airbnb.com:i-c7657a77.inst.aws.airbnb.com:i-2178ceba.inst.aws.airbnb.com:i-0b47906ec2a1d42a1.inst.aws.airbnb.com:i-0dcb33b4a23838046.inst.aws.airbnb.com:i-41fbbef2.inst.aws.airbnb.com:i-fc657a4c.inst.aws.airbnb.com:i-838dca30.inst.aws.airbnb.com:i-c1b76951.inst.aws.airbnb.com:i-0dd1add9dc1a3fab2.inst.aws.airbnb.com:i-4a6fb6d0.inst.aws.airbnb.com:i-40eb56db.inst.aws.airbnb.com:i-793e7aca.inst.aws.airbnb.com:i-03a6eada3dbfcc82a.inst.aws.airbnb.com:i-57fa28a8.inst.aws.airbnb.com:i-a2895012.inst.aws.airbnb.com:i-8ae25519.inst.aws.airbnb.com:i-01419ada19e9ffe4e.inst.aws.airbnb.com:i-6345929c.inst.aws.airbnb.com:i-2f78ceb4.inst.aws.airbnb.com:i-427857e2.inst.aws.airbnb.com:i-f5657a45.inst.aws.airbnb.com:i-a7895017.inst.aws.airbnb.com:i-0e9434f0.inst.aws.airbnb.com:i-064b5b95.inst.aws.airbnb.com:i-14cad0a5.inst.aws.airbnb.com:i-eab7697a.inst.aws.airbnb.com:i-07ca28065f9eff8dc.inst.aws.airbnb.com:i-fa489905.inst.aws.airbnb.com:i-0e7afc3c1b7a437fd.inst.aws.airbnb.com:i-5afbbee9.inst.aws.airbnb.com:i-074b5b94.inst.aws.airbnb.com:i-3208e8a1.inst.aws.airbnb.com:i-05fb4bb09b930fae6.inst.aws.airbnb.com:i-92306809.inst.aws.airbnb.com:i-56fa28a9.inst.aws.airbnb.com:i-5d4592a2.inst.aws.airbnb.com:i-394b5baa.inst.aws.airbnb.com:i-c08a5a3f.inst.aws.airbnb.com:i-0f4b5b9c.inst.aws.airbnb.com:i-0a3fabc8b1f766884.inst.aws.airbnb.com:i-7fea74e5.inst.aws.airbnb.com:i-fc489903.inst.aws.airbnb.com:i-05247674ffce0cbc6.inst.aws.airbnb.com:i-7709af88.inst.aws.airbnb.com:i-3acb8f89.inst.aws.airbnb.com:i-69ea74f3.inst.aws.airbnb.com:i-03ec89344edea473a.inst.aws.airbnb.com:i-0986e4201266fd743.inst.aws.airbnb.com:i-29cad098.inst.aws.airbnb.com:i-7dea74e7.inst.aws.airbnb.com:i-417857e1.inst.aws.airbnb.com:i-062344ad2852b9174.inst.aws.airbnb.com:i-0d03ce96.inst.aws.airbnb.com:i-46ea74dc.inst.aws.airbnb.com:i-02896c62078413343.inst.aws.airbnb.com:i-7909af86.inst.aws.airbnb.com:i-89015c19.inst.aws.airbnb.com:i-0195b515ef5ae18ec.inst.aws.airbnb.com:i-12cad0a3.inst.aws.airbnb.com:i-94f7a90f.inst.aws.airbnb.com:i-6ce28ddf.inst.aws.airbnb.com:i-bd5f960e.inst.aws.airbnb.com:i-44ea74de.inst.aws.airbnb.com:i-112cafee.inst.aws.airbnb.com:i-025031639a77743f8.inst.aws.airbnb.com:i-beea5725.inst.aws.airbnb.com:i-ad89501d.inst.aws.airbnb.com:i-0563efdbdf8add1b2.inst.aws.airbnb.com:i-7e09af81.inst.aws.airbnb.com:i-08f4d9f6904ed0824.inst.aws.airbnb.com:i-57be51c4.inst.aws.airbnb.com:i-9a4a5a09.inst.aws.airbnb.com:i-05f0e5ff8d14f8ced.inst.aws.airbnb.com:i-a3895013.inst.aws.airbnb.com:i-56be51c5.inst.aws.airbnb.com:i-f6489909.inst.aws.airbnb.com:i-ecb7697c.inst.aws.airbnb.com:i-45ea74df.inst.aws.airbnb.com:i-f7489908.inst.aws.airbnb.com:i-7003ceeb.inst.aws.airbnb.com:i-0952ac6cd3799c21c.inst.aws.airbnb.com:i-0d63b2302b08e1ba8.inst.aws.airbnb.com:i-96f7a90d.inst.aws.airbnb.com:i-e6b76976.inst.aws.airbnb.com:i-da8c736a.inst.aws.airbnb.com:i-c58a5a3a.inst.aws.airbnb.com:i-6aea74f0.inst.aws.airbnb.com:i-9081bd03.inst.aws.airbnb.com:i-132cafec.inst.aws.airbnb.com:i-7eea74e4.inst.aws.airbnb.com:i-97f7a90c.inst.aws.airbnb.com:i-436fb6d9.inst.aws.airbnb.com:i-474592b8.inst.aws.airbnb.com:i-d05ce070.inst.aws.airbnb.com:i-b263df12.inst.aws.airbnb.com:i-426fb6d8.inst.aws.airbnb.com:i-f2657a42.inst.aws.airbnb.com:i-7cea74e6.inst.aws.airbnb.com:i-edb7697d.inst.aws.airbnb.com:i-e5b76975.inst.aws.airbnb.com:i-52ea74c8.inst.aws.airbnb.com:i-7103ceea.inst.aws.airbnb.com:i-fa657a4a.inst.aws.airbnb.com:i-898dca3a.inst.aws.airbnb.com:i-c9657a79.inst.aws.airbnb.com:; InputFormatClass: org.apache.hadoop.hive.ql.io.RCFileInputFormat
 splitsize: 601 maxsize: 10
17/02/07 18:26:58 INFO mapreduce.JobSubmitter: number of splits:438
17/02/07 18:26:58 INFO mapreduce.JobSubmitter: Submitting tokens for job: job_1485118821996_834379
17/02/07 18:26:59 INFO impl.YarnClientImpl: Submitted application application_1485118821996_834379
17/02/07 18:26:59 INFO mapreduce.Job: The url to track the job: http://i-faa9b805.inst.aws.airbnb.com:8088/proxy/application_1485118821996_834379/
17/02/07 18:26:59 INFO exec.Task: Starting Job = job_1485118821996_834379, Tracking URL = http://i-faa9b805.inst.aws.airbnb.com:8088/proxy/application_1485118821996_834379/
17/02/07 18:26:59 INFO exec.Task: Kill Command = /mnt/var/opt/CDH-5.3.3-1.cdh5.3.3.p1174.932/lib/hadoop/bin/hadoop job  -kill job_1485118821996_834379
17/02/07 18:27:13 INFO exec.Task: Hadoop job information for Stage-1: number of mappers: 438; number of reducers: 1
17/02/07 18:27:14 WARN mapreduce.Counters: Group org.apache.hadoop.mapred.Task$Counter is deprecated. Use org.apache.hadoop.mapreduce.TaskCounter instead
17/02/07 18:27:14 INFO exec.Task: 2017-02-07 18:27:14,375 Stage-1 map = 0%,  reduce = 0%
17/02/07 18:28:15 INFO exec.Task: 2017-02-07 18:28:15,300 Stage-1 map = 2%,  reduce = 0%, Cumulative CPU 20.95 sec
17/02/07 18:28:16 INFO exec.Task: 2017-02-07 18:28:16,320 Stage-1 map = 6%,  reduce = 0%, Cumulative CPU 72.18 sec
17/02/07 18:28:17 INFO exec.Task: 2017-02-07 18:28:17,372 Stage-1 map = 13%,  reduce = 0%, Cumulative CPU 177.62 sec
17/02/07 18:28:18 INFO exec.Task: 2017-02-07 18:28:18,418 Stage-1 map = 17%,  reduce = 0%, Cumulative CPU 241.62 sec
17/02/07 18:28:19 INFO exec.Task: 2017-02-07 18:28:19,447 Stage-1 map = 24%,  reduce = 0%, Cumulative CPU 339.61 sec
17/02/07 18:28:20 INFO exec.Task: 2017-02-07 18:28:20,472 Stage-1 map = 32%,  reduce = 0%, Cumulative CPU 477.1 sec
17/02/07 18:28:21 INFO exec.Task: 2017-02-07 18:28:21,504 Stage-1 map = 40%,  reduce = 0%, Cumulative CPU 608.82 sec
17/02/07 18:28:22 INFO exec.Task: 2017-02-07 18:28:22,536 Stage-1 map = 46%,  reduce = 0%, Cumulative CPU 698.9 sec
17/02/07 18:28:23 INFO exec.Task: 2017-02-07 18:28:23,566 Stage-1 map = 53%,  reduce = 0%, Cumulative CPU 832.57 sec
17/02/07 18:28:24 INFO exec.Task: 2017-02-07 18:28:24,588 Stage-1 map = 56%,  reduce = 0%, Cumulative CPU 896.07 sec
17/02/07 18:28:25 INFO exec.Task: 2017-02-07 18:28:25,608 Stage-1 map = 61%,  reduce = 0%, Cumulative CPU 1027.08 sec
17/02/07 18:28:26 INFO exec.Task: 2017-02-07 18:28:26,649 Stage-1 map = 65%,  reduce = 0%, Cumulative CPU 1132.37 sec
17/02/07 18:28:27 INFO exec.Task: 2017-02-07 18:28:27,708 Stage-1 map = 67%,  reduce = 0%, Cumulative CPU 1162.98 sec
17/02/07 18:28:28 INFO exec.Task: 2017-02-07 18:28:28,731 Stage-1 map = 69%,  reduce = 0%, Cumulative CPU 1226.38 sec
17/02/07 18:28:29 INFO exec.Task: 2017-02-07 18:28:29,753 Stage-1 map = 70%,  reduce = 0%, Cumulative CPU 1268.09 sec
17/02/07 18:28:30 INFO exec.Task: 2017-02-07 18:28:30,772 Stage-1 map = 72%,  reduce = 0%, Cumulative CPU 1334.12 sec
17/02/07 18:28:31 INFO exec.Task: 2017-02-07 18:28:31,797 Stage-1 map = 74%,  reduce = 0%, Cumulative CPU 1420.67 sec
17/02/07 18:28:32 INFO exec.Task: 2017-02-07 18:28:32,816 Stage-1 map = 76%,  reduce = 0%, Cumulative CPU 1487.03 sec
17/02/07 18:28:33 INFO exec.Task: 2017-02-07 18:28:33,839 Stage-1 map = 78%,  reduce = 0%, Cumulative CPU 1564.81 sec
17/02/07 18:28:34 INFO exec.Task: 2017-02-07 18:28:34,865 Stage-1 map = 81%,  reduce = 0%, Cumulative CPU 1631.75 sec
17/02/07 18:28:35 INFO exec.Task: 2017-02-07 18:28:35,890 Stage-1 map = 82%,  reduce = 0%, Cumulative CPU 1670.22 sec
17/02/07 18:28:36 INFO exec.Task: 2017-02-07 18:28:36,916 Stage-1 map = 84%,  reduce = 0%, Cumulative CPU 1741.17 sec
17/02/07 18:28:37 INFO exec.Task: 2017-02-07 18:28:37,959 Stage-1 map = 86%,  reduce = 0%, Cumulative CPU 1814.86 sec
17/02/07 18:28:38 INFO exec.Task: 2017-02-07 18:28:38,983 Stage-1 map = 88%,  reduce = 0%, Cumulative CPU 1855.58 sec
17/02/07 18:28:40 INFO exec.Task: 2017-02-07 18:28:40,003 Stage-1 map = 89%,  reduce = 0%, Cumulative CPU 1899.42 sec
17/02/07 18:28:41 INFO exec.Task: 2017-02-07 18:28:41,027 Stage-1 map = 90%,  reduce = 0%, Cumulative CPU 1921.99 sec
17/02/07 18:28:42 INFO exec.Task: 2017-02-07 18:28:42,046 Stage-1 map = 91%,  reduce = 0%, Cumulative CPU 1967.42 sec
17/02/07 18:28:46 INFO exec.Task: 2017-02-07 18:28:46,134 Stage-1 map = 92%,  reduce = 0%, Cumulative CPU 2035.58 sec
17/02/07 18:28:48 INFO exec.Task: 2017-02-07 18:28:48,177 Stage-1 map = 93%,  reduce = 0%, Cumulative CPU 2042.73 sec
17/02/07 18:28:49 INFO exec.Task: 2017-02-07 18:28:49,198 Stage-1 map = 93%,  reduce = 31%, Cumulative CPU 2046.4 sec
17/02/07 18:28:50 INFO exec.Task: 2017-02-07 18:28:50,218 Stage-1 map = 94%,  reduce = 31%, Cumulative CPU 2054.12 sec
17/02/07 18:28:51 INFO exec.Task: 2017-02-07 18:28:51,241 Stage-1 map = 95%,  reduce = 31%, Cumulative CPU 2072.54 sec
17/02/07 18:28:53 INFO exec.Task: 2017-02-07 18:28:53,286 Stage-1 map = 96%,  reduce = 31%, Cumulative CPU 2087.62 sec
17/02/07 18:28:55 INFO exec.Task: 2017-02-07 18:28:55,330 Stage-1 map = 97%,  reduce = 32%, Cumulative CPU 2095.34 sec
17/02/07 18:29:00 INFO exec.Task: 2017-02-07 18:29:00,430 Stage-1 map = 98%,  reduce = 32%, Cumulative CPU 2125.32 sec
17/02/07 18:29:01 INFO exec.Task: 2017-02-07 18:29:01,449 Stage-1 map = 98%,  reduce = 33%, Cumulative CPU 2129.55 sec
17/02/07 18:29:05 INFO exec.Task: 2017-02-07 18:29:05,524 Stage-1 map = 99%,  reduce = 33%, Cumulative CPU 2140.48 sec
17/02/07 18:29:35 INFO exec.Task: 2017-02-07 18:29:35,167 Stage-1 map = 100%,  reduce = 33%, Cumulative CPU 2172.93 sec
17/02/07 18:29:37 INFO exec.Task: 2017-02-07 18:29:37,208 Stage-1 map = 100%,  reduce = 80%, Cumulative CPU 2174.59 sec
"""

parse(log)
