import { SupersetClient } from "@superset-ui/core";
import { AssistantSuggestionProps } from "./AssistantHome/AssistantSuggestion";

interface Descriptions {
  human_understandable: string,
  llm_optimized: string,
}


export const getTableDescription = async (data: any, target: string) => {
  const endpoint = "assistant/gemini/table"
  const request = {
    data: JSON.stringify(data),
    table_name: target
  }
  console.log("getTableDescription : Request", request);
  try {
    const response = await SupersetClient.post({ endpoint: endpoint, body: JSON.stringify(request), headers: { 'Content-Type': 'application/json' } });
    // console.log("Response", response.json);
    const responseJson = JSON.parse(response.json);
    // console.log("Response 2", responseJson);
    const descriptions: Descriptions = {
      human_understandable: responseJson["human_understandable"],
      llm_optimized: responseJson["llm_optimized"]
    }
    console.log("Response 3 ", descriptions);
    return descriptions;
  } catch (error) {
    console.error("getTableDescription: Error fetching table description:", error);
    return { human_understandable: "", llm_optimized: "" };
  }
};



export const getVizSuggestions = async (data: any, purpose: string) => {
  console.log("getVizSuggestions : Request", data);
  const suggestionColors = [
    '#FFD0EC', '#FBD0FF', '#D0E0FF', '#D0F9FF', '#FFD0EC',
  ];
  const endpoint = "assistant/gemini/viz-suggestions"
  const request = {
    data: JSON.stringify(data),
    purpose: purpose
  }
  // console.log("getVizSuggestions: Request", request);
  try {
    const response = await SupersetClient.post({ endpoint: endpoint, body: JSON.stringify(request), headers: { 'Content-Type': 'application/json' } });
    // console.log("getVizSuggestions: Response", response.json);
    const responseJson = JSON.parse(response.json);
    // console.log("getVizSuggestions : Response 2", responseJson);
    const suggestions = responseJson.map((r: any) => {
      const suggestion: AssistantSuggestionProps = {
        ...r,
        title: r["viz_type"],
        suggestion: r["description"],
        backgroundColor: suggestionColors[Math.floor(Math.random() * suggestionColors.length)]
      };
      return suggestion;
    });
    console.log("getVizSuggestions : Suggestion", suggestions);
    return suggestions;
  } catch (error) {
    console.error("getVizSuggestions: Error fetching table description:", error);
    return [];
  }
};