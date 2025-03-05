import {
  AIMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { RunnableConfig } from "@langchain/core/runnables";
import { GraphState, llm } from "../index";
import { gmailSearchTool } from "../tools";

/**
 * ANALYST AGENT
 * - Converts user request into a valid Gmail query
 * - Calls gmailSearchTool with that query
 * - Passes raw results back to the Supervisor (summarization handled elsewhere)
 */
export const analystAgent = async (
  data: typeof GraphState.State,
  config?: RunnableConfig
) => {
  // The LLM instance with access to the gmailSearchTool
  const analystLLM = llm.bindTools([gmailSearchTool]);

  if (!data.analystFinished) {
    // Convert the user request into a Gmail query and call the tool
    const analystResult = await analystLLM.invoke(data.analyst_msgs, {
      tool_choice: "gmailSearchTool",
    });

    console.log("Analyst Result:", analystResult);

    return new Command({
      goto: "tool_node",
      update: {
        analyst_msgs: [analystResult],
      },
    });
  } else {
    const finalAnalystMessage = (data.analyst_msgs[data.analyst_msgs.length - 1]) as BaseMessage;
    const emails = JSON.parse(JSON.stringify(finalAnalystMessage.content)); // Assuming JSON from gmailSearchTool
    const summaries = emails.map(email => ({
      subject: email.subject,
      from: email.from,
      date: email.date,
      summary: "Summary of " + email.body + " and " + (email.attachments?.join(", ") || "no attachments"),
    }));
    return new Command({
      goto: "supervisorAgent",
      update: {
        supervisor_msgs: [
          new AIMessage({
            content: JSON.stringify(summaries),
            name: "analyst",
          }),
        ],
        analystFinished: true,
      },
    });
  }
};