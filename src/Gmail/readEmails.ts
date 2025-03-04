import { extractBody, downloadAttachments } from "./gmailUtils";
import { google } from "googleapis";

export async function readEmails(
  auth: any,
  query: string = ""
): Promise<any[]> {
  const gmail = google.gmail({ version: "v1", auth });
  const emailsList: any[] = [];

  try {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 50,
    });
    const { messages } = res.data;
    if (!messages || messages.length === 0) {
      console.log("No messages found.");
      return emailsList;
    }

    for (const message of messages) {
      if (!message.id) {
        continue;
      }

      // Retrieve full message details
      const emailRes = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
        format: "full",
      });

      const { payload } = emailRes.data;
      const headersArray = payload?.headers || [];
      const headers = headersArray.reduce((acc: any, header: any) => {
        acc[header.name.toLowerCase()] = header.value;
        return acc;
      }, {});

      // Extract header values
      const from = headers["from"] || "N/A";
      const to = headers["to"] || "N/A";
      const cc = headers["cc"] || "N/A";
      const bcc = headers["bcc"] || "N/A";
      const subject = headers["subject"] || "N/A";
      const date = headers["date"] || "N/A";
      const body = extractBody(payload || {});

      let attachments: string[] = [];
      if (payload?.parts && Array.isArray(payload.parts)) {
        attachments = await downloadAttachments(
          gmail,
          message.id,
          payload.parts
        );
      }

      const emailDetails = {
        id: message.id,
        date,
        from,
        to,
        cc,
        bcc,
        subject,
        body,
        attachments,
      };

      emailsList.push(emailDetails);
    }
  } catch (error) {
    console.error("Error reading emails:", error);
  }
  return emailsList;
}
