from langchain_core.pydantic_v1 import BaseModel, Field
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI


model = ChatOpenAI(model="gpt-3.5-turbo")

#### perser table description

class program_understandable_description(BaseModel):
    description: str = Field(..., description="A program-understandable description of the table, more detailed than the human-understandable description")
    columns: dict = Field(..., description="A list of dictionaries, where each dictionary contains the column name as the key and a detailed description of the column as its table as its value")

class table_description(BaseModel):
    human_understandable: str = Field(..., description="A human-understandable description of the table")
    llm_optimized: program_understandable_description = Field(..., description="A program-optimized description of the table")
    
    

class VisualizationSuggestion(BaseModel):
    viz_type: str = Field(description="Type of visualization to use, e.g., bar_chart, line_chart")
    description: str = Field(description="A short, human-readable description of what the visualization will show")
    reasoning: str = Field(description="Explanation behind the visualization choice")
    viz_datasources: str = Field(description="SQL queries used to source data for the visualization")
    llm_optimized: str = Field(description="Optimized instructions on how the data should be visualized. Explaining how the data from viz_datasources can be modified using sql expressions to create the visualization")
    databaseId: str = Field(description="ID of the database")
    schemaName: str = Field(description="Name of the schema")
    backend: str = Field(description="Database backend type")
    
    
#### perser visualization suggestion

table_description_parser = JsonOutputParser(pydantic_object=table_description)

viz_parser = JsonOutputParser(pydantic_object=VisualizationSuggestion)
    
    
#### prompt funtions

def table_description(data,target):
    template = """
    The following is a json schema containing data about a database Schema = {data}
    Please give a reasonable description of the data contained in the table named {target}
    
    Using the Data provided by the Schema Answer the question in the prompt below. in the following format.
    Ensure the Format is a valid json format.
    
    {format_instructions}
    """ 
    prompt = PromptTemplate(
        template=template,
        input_variables=["data"],
        partial_variables={"format_instructions": table_description_parser.get_format_instructions()}
    )
    
    chain = prompt | model | table_description_parser
    return chain.invoke({"data": data,"target":target})

def vizresponse(data, purpose,available_charts):
    template = """
    The following is a json schema containing data about database Schemas = {data}
    The data contains information collected by an organization for the purpose of {purpose}.
    Using the Data provided by the Schema, provide suggestions for visualizations that can be created from the data that may be useful to the organization.
    Available visualizations are: {available_charts}.
    Order the suggestions according to importance and relevance to the organization's purpose.
    The response should be in the following format:
    - Avoid referencing the organization or its purpose in the response.
    - Do not use data whose "selected" key is false.
    - Do not use tables whose "data" key is not present or is an empty list or dictionary.
    - Do not suggest a viz_type if the query needed to generate the visualization cannot provide the data needed for the visualization.
    - Do not suggest a viz_type that is not available in the Available visualizations.
    - Only suggest a maximum of 5 visualizations.
    - Only use data from above to generate the response.

    Any SQL queried generated should have the following constraints:
    - "The number of viz_datasource MUST be equal to the viz_type datasourceCount.",
    -"For example, if the schema contains a table named 'bart_lines', the query should be 'SELECT `column` FROM `schemaname`."bart_lines".",
    -"The queries must be consistent with the data provided in the schema.",
    -"The queries should select only the columns that are relevant to the visualization and columns that are selected.",
    -"For example, if the visualization is a bar chart that shows the number of passengers per line, the query should be 'SELECT `line_name`, `passengers` FROM `schemaname`."bart_lines";",
    -"The queries should filter out nulls for the columns selected.",
    -"Use enclosures compatible with the database backend being used. i.e `column_name` for MySQL, \"column_name\" for PostgreSQL.",
    -"The queries should ensure that castings are done only when necessary and filters added to support valid casting.",
    -"The queries should not include any grouping as the grouping will be done by the visualization based on the llm_optimized description.",
    -"The queries should not include any ordering as the ordering will be done by the visualization based on the llm_optimized description.",
    -"The queries should not include any limit as the limit will be done by the visualization based on the llm_optimized description.",
    -"The queries should try to standardize the data.",
    -"For example, if the data is in different units, the queries should convert the data to a single unit.",
    -"If the data is a mix of upper and lower case, the queries should convert the data to a single case.",
    -"The query MUST be a valid SQL query. For the database backend ",
    -"Join queries are allowed accross schemas in the same database.",
    -"The queries should try and make vizualizations labels are human readable. E.G for queries returning ids, the queries should join with tables that have human readable names. ONLY if the human readable names are available AND selected in the schema.",
    -"Make no assumptions about the data in the database.",
    
    
    {format_instructions}
    """
    prompt = PromptTemplate(
        template=template,
        input_variables=["data","purpose","available_charts"],
        partial_variables={"format_instructions": viz_parser.get_format_instructions()}
    )
    chain = prompt | model | viz_parser
    return chain.invoke({"data": data, "purpose": purpose, "available_charts": available_charts})

