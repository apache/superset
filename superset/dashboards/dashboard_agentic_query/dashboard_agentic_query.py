from langchain.agents import Tool, ZeroShotAgent, AgentExecutor
from langchain_openai import ChatOpenAI
from langchain import LLMChain
from langchain.prompts import PromptTemplate
import time

import urllib3
from superset.dashboards.dashboard_agentic_query.get_all_charts_name import get_charts_list
from superset.dashboards.dashboard_agentic_query.get_chart_data import get_chart_data
from superset.dashboards.dashboard_agentic_query.unix_timestamp_to_human_readable import convert_unix_to_human_readable
from flask import current_app

urllib3.disable_warnings(category=urllib3.exceptions.InsecureRequestWarning)

DASHBOARD_AGENTIC_QUERY_CONFIG = current_app.config["DASHBOARD_AGENTIC_QUERY_CONFIG"]

mrkl_template_value = '''
Answer the following questions as best you can. You have access to the following tools:
-> You must never do any hallucinations.
-> You must never call a tool more than once for same input
-> If date is given in Unix timestamps then convert it into human readable format

get_charts_list: This tool will give list of all chart_names in a dashboard along with their chart_id, it takes a string dashboard_id as input.
get_chart_data: This tool will return the data used to create a particular chart, it takes a string chart_id as input.
convert_unix_to_human_readable: This tool will convert unix timestamp into human readable format, it takes a string unix_timestamp and returns a string i.e human readable format of that timestamp.

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [get_charts_list, get_chart_data, convert_unix_to_human_readable]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Begin!

Question: {input}
Thought:{agent_scratchpad}
'''

prompt_template = PromptTemplate(
    input_variables=["input", "agent_scratchpad"],
    template=mrkl_template_value,
)

llm = ChatOpenAI(
    model = DASHBOARD_AGENTIC_QUERY_CONFIG["model"],
    temperature = DASHBOARD_AGENTIC_QUERY_CONFIG["temperature"],
    max_tokens = DASHBOARD_AGENTIC_QUERY_CONFIG["max_tokens"],
    timeout = DASHBOARD_AGENTIC_QUERY_CONFIG["timeout"],
    max_retries = DASHBOARD_AGENTIC_QUERY_CONFIG["max_retries"],
    api_key = DASHBOARD_AGENTIC_QUERY_CONFIG["api_key"],
    base_url = DASHBOARD_AGENTIC_QUERY_CONFIG["base_url"]
)

# Define the tools
tools = [
    Tool(
        name='get_charts_list',
        func=get_charts_list,
        description="This tool will give list of all chart_names in a dashboard along with their chart_id, it takes a string dashboard_id as input."
    ),
    Tool(
        name='get_chart_data',
        func=get_chart_data,
        description="This tool will return the data used to create a particular chart, it takes a string chart_id as input."
    ),
    Tool(
        name='convert_unix_to_human_readable',
        func=convert_unix_to_human_readable,
        description="This tool will convert unix timestamp into human readable format, it takes a string unix_timestamp and returns a string i.e human readable format of that timestamp."
    )
]

llm_chain = LLMChain(llm=llm, prompt=prompt_template)

tool_names = [tool.name for tool in tools]
agent = ZeroShotAgent(llm_chain=llm_chain, allowed_tools=tool_names)

# print("Prompt Template :: ", agent.llm_chain.prompt.template)

agent_executor = AgentExecutor.from_agent_and_tools(
    agent=agent, tools=tools, verbose=True
)

def ask_agent_query(query, dashboard_id):
    starttime = time.time()
    
    reformatted_query = f'{query}\ndashboard_id : {dashboard_id}'
    result = agent_executor.run(f"Give short and crisp answer for following question : \n\n{reformatted_query}")

    endtime = time.time()

    print("Time taken for agentic query :: ", endtime-starttime)
    print("Final result for agentic query :: ", result)
    return result
