import axios from "axios";
import dotenv from "dotenv";
import { getGeminiEmbeddings } from "./vectoreStore"; // Correct import for embeddings
import { pineconeIndex, GeminiKey, pineconeKey } from "./testEnv"; // Ensure these are properly initialized

dotenv.config();

async function queryDocuments(query: string) {
  console.log(`🔍 Generating embeddings for query: "${query}"`);

  const queryVector = await getGeminiEmbeddings(query);

  if (!queryVector || !Array.isArray(queryVector) || queryVector.length === 0) {
    console.error(
      "❌ No valid query vector generated. Ensure the embedding function works correctly."
    );
    return [];
  }

  try {
    console.log("🔍 Searching Pinecone for similar documents...");

    // Validate queryVector is a valid array of numbers
    if (
      !Array.isArray(queryVector) ||
      !queryVector.every((num) => typeof num === "number")
    ) {
      throw new Error("❌ Query vector is not a valid number array.");
    }

    const searchResults = await pineconeIndex.query({
      vector: queryVector,
      topK: 10,
      includeMetadata: true,
    });

    if (
      !searchResults ||
      !searchResults.matches ||
      searchResults.matches.length === 0
    ) {
      console.log("❌ No relevant documents found.");
      return [];
    }

    const documents = searchResults.matches.map((match) => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata || {},
    }));

    console.log("✅ Relevant Documents:", JSON.stringify(documents, null, 2));
    return documents;
  } catch (error) {
    console.error("❌ Error querying Pinecone:", error);
    return [];
  }
}

// Example usage
queryDocuments("Summary of this document in 500 words?").then((results) =>
  console.log("Query Results:", results)
).catch((error) => console.error("Error in query:", error));

export { queryDocuments }; // Export for use in other files