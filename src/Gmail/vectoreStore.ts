import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
import { pineconeIndex } from "./testEnv"; // Import environment vars and Pinecone index
import { queryDocuments } from "./query"; // Import the query function

dotenv.config();

// Initialize Google Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Initialize Pinecone client (if not already initialized in testEnv.ts)
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "", // Replace with your Pinecone API key
//   environment: process.env.PINECONE_ENVIRONMENT || "us-west1-gcp", // Adjust environment as needed
});

// Function to generate embeddings using Gemini API
export async function getGeminiEmbeddings(text: string): Promise<number[]> {
  try {
    console.log(`📐 Generating Gemini embeddings for text: "${text}"`);

    // Use the Gemini API to generate embeddings
    const model = genAI.getGenerativeModel({ model: "embedding-001" }); // Use the embedding model
    const result = await model.embedContent(text);

    // Extract the embedding vector (assuming result.embedding.values is the array of numbers)
    const embedding = result.embedding.values;

    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("❌ Gemini API returned no valid embedding.");
    }

    console.log(`✅ Generated embedding length: ${embedding.length}`);
    return embedding;
  } catch (error) {
    console.error("❌ Error generating Gemini embeddings:", error);
    return [];
  }
}

// Function to store email content in Pinecone
export async function storeEmailInPinecone(email: {
  id: string;
  subject: string;
  body: string;
  attachments?: string[];
  from: string;
  date: string;
}) {
  try {
    console.log(`📦 Storing email ${email.id} in Pinecone...`);

    // Combine email body and attachments into a single text string
    const fullText = `${email.subject} ${email.body} ${
      email.attachments?.join(" ") || ""
    }`.trim();

    // Generate embedding for the combined text
    const embedding = await getGeminiEmbeddings(fullText);

    if (!embedding || embedding.length === 0) {
      throw new Error("❌ Failed to generate embedding for email content.");
    }

    // Upsert the embedding into Pinecone
    await pineconeIndex.upsert([
      {
        id: email.id,
        values: embedding,
        metadata: {
          subject: email.subject,
          from: email.from,
          date: email.date,
          bodySnippet: email.body.substring(0, 100), // Store a snippet for reference
          hasAttachments: !!email.attachments?.length,
        },
      },
    ]);

    console.log(`✅ Email ${email.id} stored in Pinecone.`);
  } catch (error) {
    console.error("❌ Error storing email in Pinecone:", error);
  }
}

// Example usage (optional, for testing)
async function testEmbedding() {
  const sampleEmail = {
    id: "email-123",
    subject: "Project Update",
    body: "The project is delayed due to resource issues.",
    attachments: ["PDF: Revised timeline shows completion by March 15."],
    from: "manohar@example.com",
    date: "2025-03-04",
  };

  await storeEmailInPinecone(sampleEmail);
  const queryResult = await queryDocuments("project delay status");
  console.log("Query Result:", queryResult);
}

// Uncomment to test
testEmbedding();