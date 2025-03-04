// import fs from "fs";
// import path from "path";
// import pdfParse from "pdf-parse";
// // import { LLMChain, PromptTemplate } from "langchain";
// import { Pinecone } from "@pinecone-database/pinecone";
// import dotenv from "dotenv";
// import { GoogleGenerativeAI } from "@google/generative-ai";
// import {
//   pineconeIndex,
//   pineconeKey,
//   GeminiKey,
//   pineconeEnv,
// } from "../Gmail/testEnv";
// // import llm from "./index";
// dotenv.config();

// // const gemini = new GoogleGenerativeAI(GeminiKey);
// // const embeddingModel = gemini.getEmbeddingModel({model :"textembeeding-gecko"});

// const pinecone = new Pinecone({ apiKey: pineconeKey });
// const index = pinecone.index(pineconeIndex);

// const extractText = async (filePath: string): Promise<string> => {
//   const ext = path.extname(filePath).toLowerCase();
//   if (ext === ".txt") {
//     return fs.promises.readFile(filePath, "utf-8");
//   } else if (ext === ".pdf") {
//     const data = await pdfParse(await fs.promises.readFile(filePath));
//     return data.text;
//   } else {
//     throw new Error(`Unsupported file type: ${ext}`);
//   }
// };

// extractText(
//   "D:\\Dice\\DiceGPT\\attachments\\_Dice II AP & P2P Automation_ORACLE (1).pdf"
// );
