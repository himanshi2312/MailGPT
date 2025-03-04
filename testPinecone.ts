import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";

dotenv.config();

// Ensure API key is loaded
if (!process.env.PINECONE_API_KEY) {
  throw new Error("Missing Pinecone API Key. Please check your .env file.");
}
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
  // environment: process.env.PINECONE_ENV!,
});

export const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);
console.log(pineconeIndex);
console.log(process.env.PINECONE_API_KEY);

export const pineconeKey = process.env.PINECONE_API_KEY;
console.log(pineconeKey);
export const GeminiKey = process.env.GEMINI_API_KEY;
console.log(GeminiKey);
export const pineconeEnv = process.env.PINECONE_ENVIRONMENT;
console.log(pineconeEnv);
