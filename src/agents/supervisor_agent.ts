import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { Annotation, Command, StateGraph } from "@langchain/langgraph";
import { RunnableConfig } from "@langchain/core/runnables";
import { GraphState, llm } from "../index.ts";
import { response_tool } from "../tools";

/**
 * SUPERVISOR AGENT
 * Delegates to the Analyst if needed, or responds directly to the user.
 */
export const supervisorAgent = async (
  data: typeof GraphState.State,
  config?: RunnableConfig
) => {
  const result = await llm
    .bindTools([response_tool], { tool_choice: "response_tool" })
    .invoke(data.supervisor_msgs, config);

  // If no tool calls, do nothing
  if (!result?.tool_calls?.length) {
    return new Command({
      goto: "__end__",
      update: {
        supervisor_msgs: [
          new AIMessage({ content: "No tools were called.", name: "system" }),
        ],
      },
    });
  }

  // If the user or LLM decides to talk to the analyst:
  const toolCall = result.tool_calls[0];
  const { to, response } = toolCall.args;

  if (to === "analyst") {
    // Forward to the Analyst
    return new Command({
      goto: "analystAgent",
      update: {
        analyst_msgs: [new HumanMessage({ content: response })],
        supervisor_msgs: [new AIMessage({ content: response })],
      },
    });
  }

  // If "to": "user", we finalize the conversation
  return new Command({
    goto: "__end__",
    update: {
      supervisor_msgs: [new AIMessage({ content: response })],
    },
  });
};
