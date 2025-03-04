// testAgent.ts
import { useAgent } from "./src/index";

process.env.LANGSMITH_TRACING_V2 = "true";
process.env.LANGSMITH_ENDPOINT = "https://api.smith.langchain.com";
process.env.LANGSMITH_API_KEY =
  "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";
process.env.LANGSMITH_PROJECT = "default";

const test = async () => {
  const user =
    "Please review all the mails in my inbox and return me the summary of the mails recieved last week from ayush";
  const response = await useAgent(user);
  console.log("Response:", response);
};

test().catch((error) => {
  console.error("Error during testing:", error);
});
