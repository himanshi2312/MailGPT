import { Pinecone } from "@pinecone-database/pinecone";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Correctly resolve the directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

console.log("✅ Pinecone API Key:", process.env.PINECONE_API_KEY);
console.log("✅ Gemini API Key:", process.env.GEMINI_API_KEY);
console.log("✅ Pinecone Environment:", process.env.PINECONE_ENVIRONMENT);
console.log("✅ Pinecone Index Name:", process.env.PINECONE_INDEX_NAME);

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
  // environment: process.env.PINECONE_ENV!,
});

export const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
console.log(pineconeIndex);
console.log(process.env.PINECONE_API_KEY);

export const pineconeKey = process.env.PINECONE_API_KEY;
console.log(pineconeKey);

export const GeminiKey = process.env.GEMINI_API_KEY;
console.log(GeminiKey);

export const pineconeEnv = process.env.PINECONE_ENVIRONMENT;
console.log(pineconeEnv);

async function checkPineconeDocuments() {
  try {
    const indexStats = await pineconeIndex.describeIndexStats();
    console.log(
      "📊 Pinecone Index Stats:",
      JSON.stringify(indexStats, null, 2)
    );
  } catch (error) {
    console.error("❌ Error retrieving Pinecone index stats:", error);
  }
}

checkPineconeDocuments();
