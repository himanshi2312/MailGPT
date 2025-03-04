import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { fetchEmails } from "./Gmail/gmail";

const OutputSchema = z.object({
  response: z.string().describe("message to user or specialist agent"),
  to: z.enum(["user", "analyst"]).describe("recipient of the message"),
});
/**
 * TOOLS
 */

// The response tool for providing final or intermediate responses
export const response_tool = tool(async (x) => x, {
  name: "response_tool",
  description: `Always use this tool to respond to either the user or the Analyst.`,
  schema: OutputSchema,
});

// Gmail Search Tool
export const gmailSearchTool = tool(
  async ({ input }) => {
    // Call your updated fetchEmails(query: string)
    const emails = await fetchEmails(input);
    console.log("Input Query:", input);
    return emails;
  },
  {
    name: "gmailSearchTool",
    description:
      "Use this tool to fetch emails from Gmail. 'input' must be a valid Gmail search query. The tool returns an array of email objects.",
    schema: z.object({
      input: z
        .string()
        .describe(
          "A valid Gmail search query, e.g., `from:john@xyz.com subject:meeting after:2025/01/01`."
        ),
    }),
  }
);
