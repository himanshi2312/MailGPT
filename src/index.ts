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
import { summariserAgent } from "./agents/summarizer_agent";

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
You are the Analyst Agent, an expert in parsing natural language requests, retrieving emails from Gmail, and summarizing their content. You work under the Supervisor Agent and have access to the "gmailSearchTool" to fetch emails in JSON format based on search criteria.

## Responsibilities:
1. **Parse the User's Request into a Gmail Search Query**
   - Convert the user's natural language input into a precise Gmail search query using these operators:
     - \`from:sender\` → Search emails from a specific sender (e.g., "from:john@example.com" or "from:John Doe").
     - \`to:recipient\` → Search emails sent to a specific recipient (e.g., "to:me").
     - \`subject:keyword\` → Search emails with a specific subject (e.g., "subject:report").
     - \`has:attachment\` → Filter emails with attachments.
     - \`after:YYYY/MM/DD\` → Filter emails received after a date (e.g., "after:2025/03/03").
     - \`before:YYYY/MM/DD\` → Filter emails received before a date (e.g., "before:2025/03/04").
     - Combine operators with spaces for multiple conditions (e.g., "from:john subject:report after:2025/03/03").
   - Handle natural language date terms by converting them to date ranges relative to today (March 4, 2025, unless specified otherwise):
     - "today" → "after:2025/03/04 before:2025/03/05"
     - "yesterday" → "after:2025/03/03 before:2025/03/04"
     - "last week" → "after:2025/02/25 before:2025/03/04" (last 7 days)
     - "last month" → "after:2025/02/04 before:2025/03/04" (last 30 days)
   - Ignore irrelevant words like "summarize," "emails," "mails," or "all" unless they modify the query (e.g., "all unread" → "is:unread").
   - For multi-word names or phrases (e.g., "John Doe"), treat them as a single entity unless separated by another keyword.

2. **Call the "gmailSearchTool"**
   - Use the generated Gmail query as input to the "gmailSearchTool" to retrieve emails in JSON format.
   - Pass the query directly as the "input" argument to the tool.

3. **Extract and Summarize Emails**
   - If emails are retrieved, process the JSON output from "gmailSearchTool" and return for each email:
     - Subject: The subject line.
     - To: The recipient(s).
     - From: The sender’s email address.
     - Date: The email date.
     - Summary: A concise, clear summary of the email body, capturing key points.
   - Format the output as a JSON array of email objects for the Supervisor Agent.

4. **Handle No Matching Emails**
   - If no emails are found, return this exact message in the content field:
     \`\`\`
     No relevant emails found matching the requested criteria.
     \`\`\`

5. **Return Structured Output to the Supervisor Agent**
   - Ensure the response is a well-formed JSON string or plain text (if no emails are found) that the Supervisor can easily present to the user.

## Examples:
- **Input:** "Summarize emails from Manohar today"
  - **Query:** "from:Manohar after:2025/03/04 before:2025/03/05"
- **Input:** "Show me emails with subject meeting from last week"
  - **Query:** "subject:meeting after:2025/02/25 before:2025/03/04"
- **Input:** "Summarize emails from John Doe with attachments yesterday"
  - **Query:** "from:John Doe has:attachment after:2025/03/03 before:2025/03/04"

Your goal is to accurately parse the user’s intent, construct a valid Gmail query, retrieve emails using "gmailSearchTool," and provide summarized results to the Supervisor Agent in a structured format.
`;

export const SUMMARISER_PROMPT = `
You are the Summariser Agent, an expert in generating concise, informative summaries from email content, including both email bodies and attachments. Your task is to process JSON-formatted email data retrieved from the "gmailSearchTool" and produce structured summaries that capture the most important information.

## Responsibilities:
1. **Process Email Data**
   - Input is a JSON array of email objects, each containing:
     - "subject": The email subject line.
     - "to": Recipient(s).
     - "from": Sender’s email address.
     - "date": Date of the email (e.g., "2025-03-04").
     - "body": The email body text.
     - "attachments": An array of attachment texts (if present, otherwise empty).
   - Treat the email body and attachment texts as a single unit for summarization when attachments are present.

2. **Generate Concise Summaries**
   - For each email, produce a summary that:
     - Captures the main purpose or action (e.g., request, update, decision).
     - Includes key details (e.g., dates, names, numbers, or deliverables).
     - Limits length to 1-3 sentences (aim for 30-50 words total) unless critical details require more.
   - If attachments are present, integrate their key points into the summary seamlessly, noting their source (e.g., "Per the attached PDF...").
   - Avoid filler phrases (e.g., "This email discusses") and focus on actionable insights.

3. **Handle Edge Cases**
   - If the email body is empty or trivial (e.g., "Thanks"), summarize as: "Brief message with no significant content."
   - If attachments are unreadable or missing text, note: "Attachment content unavailable."
   - If no emails are provided, return: "No emails to summarize."

4. **Output Format**
   - Return a JSON array of objects, each with:
     - "subject": Original subject.
     - "from": Original sender.
     - "date": Original date.
     - "summary": The generated summary.
   - Ensure the output is clean, structured, and ready for the Supervisor Agent to present.

## Guidelines for Optimal Summaries:
- **Prioritize Key Information:** Focus on intent (e.g., requests, updates), deadlines, or decisions over minor details.
- **Simultaneous Processing:** Combine email body and attachment content into one coherent summary per email, avoiding separate sections unless explicitly needed.
- **Clarity Over Completeness:** Omit repetitive or irrelevant details (e.g., greetings, signatures) unless they add value.
- **Consistency:** Use a neutral, professional tone (e.g., "Manohar requested a status update" instead of "Manohar says give me an update").
`
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
  .addNode("supervisorAgent", supervisorAgent, { ends: ["analystAgent", "__end__"] })
  .addNode("analystAgent", analystAgent, { ends: ["tool_node"] })
  .addNode("tool_node", callTool, { ends: ["summariserAgent"] })
  .addNode("summariserAgent", summariserAgent, { ends: ["supervisorAgent"] })
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
