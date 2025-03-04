process.env.LANGSMITH_TRACING_V2 = "true";
process.env.LANGSMITH_ENDPOINT = "https://api.smith.langchain.com";
process.env.LANGSMITH_API_KEY =
  "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";
process.env.LANGSMITH_PROJECT = "default";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { config } from "dotenv";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { ChatVertexAI } from "@langchain/google-vertexai";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { Annotation, Command, StateGraph } from "@langchain/langgraph";
import { RunnableConfig } from "@langchain/core/runnables";
import { gmailSearchTool } from "./tools";
import { supervisorAgent } from "./agents/supervisor_agent";
import { analystAgent } from "./agents/analyst_agent";

config();

// process.env.GOOGLE_APPLICATION_CREDENTIALS =
//   "D:/Dice/assignment/src/assistant/gemini_key.json";

/**
 * PROMPTS
 * Supervisor prompts the user for any additional info and hands off to the Analyst.
 * Analyst converts the user's request into a Gmail query, calls the "gmailSearchTool",
 * and then summarizes the emails for the Supervisor.
 */
const SUPERVISOR_PROMPT = `
You are the Supervisor Agent, responsible for coordinating with the Analyst Agent to assist users in retrieving, classifying, and summarizing emails.

## Responsibilities:
1. **Delegate Email-Related Queries to the Analyst Agent**
   - If the user requests email classification, extraction, or summarization, forward the request to the Analyst Agent.

2. **Receive and Format Email Summaries from the Analyst Agent**

3. **Receive and Format Email Summaries from the Analyst Agent**
   - The Analyst Agent will return an array of emails in JSON format containing:
     - Subject
     - To
     - From
     - Date
     - A detailed summary of the email body
   - If no relevant emails are found, return the following message:
     \`\`\`
     No relevant emails found matching the requested criteria.
     \`\`\`

4. **Present the Response to the User in a Clear & Visually Pleasing Format**
   - Ensure well-structured output for readability.
   - Organize emails using bullet points or sections to improve clarity.

If no emails match the query, return:
\`\`\`
No relevant emails found matching the requested criteria.
\`\`\`

Your role is to ensure a seamless interaction between the user and the Analyst Agent while maintaining clarity and structure in responses.
`;

const ANALYST_PROMPT = `
You are the Analyst Agent.
You specialize in reading, classifying, and summarizing emails from the user's inbox.
You have access to a "gmailSearchTool" that retrieves emails in JSON format based on search criteria.

## Responsibilities:
1. **Parse the User's Request into a Gmail Search Query**
   - Extract keywords and convert them into a valid Gmail search query using operators:
     - \`subject:keyword\` → Search emails by subject.
     - \`from:email@example.com\` → Search emails from a specific sender.
     - \`after:YYYY/MM/DD\` → Filter emails received after a given date.
     - \`before:YYYY/MM/DD\` → Filter emails received before a given date.
     - \`is:unread\` → Retrieve only unread emails.
   - Convert natural language timeframes into precise date queries:
     - "today" → \`after:YYYY/MM/DD before:YYYY/MM/DD\`
     - "last week" → \`after:YYYY/MM/DD-7 before:YYYY/MM/DD\`
     - "last month" → \`after:YYYY/MM/DD-30 before:YYYY/MM/DD\`
     - "before two months" → \`before:YYYY/MM/DD-60\`

2. **Call the "gmailSearchTool"**
   - Pass the generated Gmail query as input to the \`gmailSearchTool\` to fetch relevant emails in JSON format.

3. **Extract and Summarize Emails**
   - If relevant emails are found, return for each email:
     -Subject:The subject line of the email.
     -To:The recipient(s).
     -From:The sender’s email address.
     -Date: The date of the email
     -Summary: A clear, structured, and informative summary of the email body.

4. **Handle No Matching Emails**
   - If no relevant emails are found, return the following message:
     \`\`\`
     No relevant emails found matching the requested criteria.
     \`\`\`

5. **Return the Structured Output to the Supervisor Agent**
   - Ensure the extracted data is clean, formatted, and free from unnecessary elements.
   - The Supervisor Agent will use this information to respond to the user efficiently.

If no emails match the query, return:
\`\`\`
No relevant emails found matching the requested criteria.
\`\`\`

Your goal is to efficiently parse, retrieve, and summarize emails, ensuring clarity and accuracy in your responses.
`;

const SUMMARISER_PROMPT = "";
/**
 * STATE DEFINITIONS
 */
export const GraphState = Annotation.Root({
  supervisor_msgs: Annotation<BaseMessage[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [new SystemMessage(SUPERVISOR_PROMPT)],
  }),
  analyst_msgs: Annotation<BaseMessage[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [new SystemMessage(ANALYST_PROMPT)],
  }),
  analystFinished: Annotation<boolean>({
    default: () => false,
    reducer: (prev, next) => (next !== undefined ? next : prev),
  }),
  summariser_msgs: Annotation<BaseMessage[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [new SystemMessage(SUMMARISER_PROMPT)],
  }),
});

/**
 * LLM Setup
 */
export const llm = new ChatVertexAI({
  model: "gemini-1.5-flash-002",
  maxOutputTokens: 8192,
  temperature: 0.2,
  safetySettings: [
    {
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      threshold: "BLOCK_ONLY_HIGH",
    },
    {
      category: "HARM_CATEGORY_CIVIC_INTEGRITY",
      threshold: "BLOCK_ONLY_HIGH",
    },
    {
      category: "HARM_CATEGORY_HATE_SPEECH",
      threshold: "BLOCK_ONLY_HIGH",
    },
    {
      category: "HARM_CATEGORY_HARASSMENT",
      threshold: "BLOCK_ONLY_HIGH",
    },
    {
      category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      threshold: "BLOCK_ONLY_HIGH",
    },
  ],
});

/**
 * TOOL NODE
 * Actually calls the gmailSearchTool with whatever arguments the LLM specified.
 * Then marks the analyst as finished so we can finalize the conversation.
 */
const toolNode = new ToolNode([gmailSearchTool]);

const callTool = async (
  data: typeof GraphState.State,
  config?: RunnableConfig
) => {
  const lastMessage = data.analyst_msgs[data.analyst_msgs.length - 1];

  if (!lastMessage || !(lastMessage as any).tool_calls?.length) {
    console.error("No tool call in the last message");
    return new Command({ goto: "__end__", update: {} });
  }

  // Execute the tool call with the provided 'input' (the query)
  const response = await toolNode.invoke({
    messages: [
      new AIMessage({
        content: "",
        tool_calls: [
          {
            id: (lastMessage as any).tool_calls[0].id,
            type: "tool_call",
            name: (lastMessage as any).tool_calls[0].name,
            args: (lastMessage as any).tool_calls[0].args,
          },
        ],
      }),
    ],
  });

  const res = response.messages[0];

  // Mark the analyst as finished so it can finalize the response
  return new Command({
    goto: "analystAgent",
    update: {
      analyst_msgs: [
        new ToolMessage({
          content: res.content,
          name: res.name,
          tool_call_id: (lastMessage as any).tool_calls[0].id,
        }),
      ],
      analystFinished: true,
    },
  });
};

/**
 * STATEGRAPH WORKFLOW
 */
const workflow = new StateGraph(GraphState)
  .addNode("supervisorAgent", supervisorAgent, {
    ends: ["analystAgent", "__end__"],
  })
  .addNode("analystAgent", analystAgent, {
    ends: ["supervisorAgent", "tool_node"],
  })

  .addNode("tool_node", callTool, {
    ends: ["analystAgent"],
  })
  .addEdge("__start__", "supervisorAgent");

const graph = workflow.compile();

/**
 * PUBLIC FUNCTION TO USE THIS AGENT
 */
export const useAgent = async (userMessage: string) => {
  const result = await graph.invoke({
    supervisor_msgs: [new HumanMessage({ content: userMessage })],
  });
  const lastMessage = result.supervisor_msgs[result.supervisor_msgs.length - 1];
  console.log("Final supervisor message:", lastMessage);
  return lastMessage;
};

const test = async () => {
  const user = "Summarise the mail i received today from manohar";
  const response = await useAgent(user);
  console.log("Response:", response);
};

test().catch((error) => {
  console.error("Error during testing:", error);
});
