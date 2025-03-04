// encryption.js
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

const secret_key = "a9a1c054-273d-4e06-a2ad-713eed62de95";
const secret_iv = "850a4814-626f-4ccd-9732-e0018a742d62";

const ecnryption_method = "aes-256-cbc";

// Generate secret hash with crypto to use for encryption
const key = crypto
  .createHash("sha512")
  .update(secret_key)
  .digest("hex")
  .substring(0, 32);
const encryptionIV = crypto
  .createHash("sha512")
  .update(secret_iv)
  .digest("hex")
  .substring(0, 16);

// Encrypt data
export function encryptData(data: string) {
  const cipher = crypto.createCipheriv(ecnryption_method, key, encryptionIV);
  return Buffer.from(
    cipher.update(data, "utf8", "hex") + cipher.final("hex")
  ).toString("base64"); // Encrypts data and converts to hex and base64
}

// Decrypt data
export function decryptData(encryptedData: string) {
  const buff = Buffer.from(encryptedData, "base64");
  const decipher = crypto.createDecipheriv(
    ecnryption_method,
    key,
    encryptionIV
  );
  return (
    decipher.update(buff.toString("utf8"), "hex", "utf8") +
    decipher.final("utf8")
  ); // Decrypts data and converts to utf8
}

export const parseToJSON = (input: any) => {
  if (typeof input !== "string") return input;
  //Remove json  markers and new lines
  const jsonString = input.replace(/```json\n|\n```/g, "").replace(/\n/g, "");
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error(error);
    // Convert invalid JSON to valid JSON
    const validJsonString = jsonString
      .replace(/(\w+):/g, '"$1":') //Convert key:value to "key":value
      .replace(/\n/g, "\\n") //Convert new lines to \n
      .replace(/\t/g, "\\t"); //Convert tabs to \t
    try {
      return JSON.parse(validJsonString);
    } catch (error) {
      console.error(error);
      return input;
    }
  }
};
