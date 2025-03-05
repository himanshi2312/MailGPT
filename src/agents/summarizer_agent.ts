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
import { SUMMARISER_PROMPT } from '../index'

/**
 * ANALYST AGENT
 * - Converts user request into a valid Gmail query
 * - Calls gmailSearchTool with that query
 * - Summarizes results
 * - Passes final summarized info back to the Supervisor
 */


export const summariserAgent = async (
  data: typeof GraphState.State,
  config?: RunnableConfig
) => {
  const summariserLLM = llm;
  const toolOutput = data.analyst_msgs[data.analyst_msgs.length - 1];
  const emails = JSON.parse(JSON.stringify(toolOutput.content));
  const summaries = await summariserLLM.invoke([
    new SystemMessage(SUMMARISER_PROMPT),
    new HumanMessage({ content: JSON.stringify(emails) }),
  ]);
  return new Command({
    goto: "supervisorAgent",
    update: {
      supervisor_msgs: [new AIMessage({ content: summaries.content, name: "summariser" })],
    },
  });
};