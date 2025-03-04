import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { RunnableConfig } from "@langchain/core/runnables";
import { GraphState, llm } from "../index";
import { gmailSearchTool } from "../tools";

/**
 * ANALYST AGENT
 * - Converts user request into a valid Gmail query
 * - Calls gmailSearchTool with that query
 * - Summarizes results
 * - Passes final summarized info back to the Supervisor
 */
export const analystAgent = async (
  data: typeof GraphState.State,
  config?: RunnableConfig
) => {
  // The LLM instance with access to the gmailSearchTool
  const analystLLM = llm.bindTools([gmailSearchTool]);

  if (!data.analystFinished) {
    // Let the LLM produce or use the query, and call the tool.
    // Then we handle the tool result in the next step (tool_node).
    const analystResult = await analystLLM.invoke(data.analyst_msgs, {
      tool_choice: "gmailSearchTool",
    });

    console.log("Analyst Result", analystResult);

    return new Command({
      goto: "tool_node",
      update: {
        analyst_msgs: [analystResult],
      },
    });
  } else {
    // If the Analyst is finished, we pass the final content to the Supervisor
    const finalAnalystMessage = data.analyst_msgs[data.analyst_msgs.length - 1];
    // console.log("Final Analyst Message", finalAnalystMessage);

    return new Command({
      goto: "supervisorAgent",
      update: {
        supervisor_msgs: [
          new AIMessage({
            // The LLM might produce a JSON or text summary of the emails.
            // If it's JSON, you may want to parse it or format it.
            // Here we simply pass it as a string.
            content: JSON.stringify(finalAnalystMessage.content),
            name: "analyst",
          }),
        ],
        analystFinished: true,
      },
    });
  }
};
