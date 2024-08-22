import { SupersetClient } from "@superset-ui/core";

interface Descriptions{
    human_understandable: string,
    llm_optimized: string,
}


export const getTableDescription = async (data: any, target: string) => {
    const endpoint = "assistant/gemini"
    const request = {
      data: JSON.stringify(data),
      table_name: target
    }
    console.log("Request", request);
    try {
      const response = await SupersetClient.post({endpoint: endpoint, body: JSON.stringify(request), headers: { 'Content-Type': 'application/json' }});
      console.log("Response", response.json);
      const responseJson = JSON.parse(response.json);
      console.log("Response 2", responseJson);
      const descriptions: Descriptions = {
        human_understandable:responseJson["human_understandable"],
        llm_optimized: responseJson["llm_optimized"]
      }
      console.log("Response 3 ", descriptions);
      return descriptions;
    } catch (error) {
      console.error("Error fetching table description:", error);
      return {human_understandable: "", llm_optimized: ""};
    }
};