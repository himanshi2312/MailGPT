import * as fs from "fs/promises";
import * as path from "path";
function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf8");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

export function extractBody(payload: any): string {
  let body = "";

  // Check if this payload has a 'body.data' value.
  if (payload.body && payload.body.data) {
    if (payload.mimeType && payload.mimeType === "text/html") {
      body += stripHtml(decodeBase64Url(payload.body.data));
    } else {
      body += decodeBase64Url(payload.body.data);
    }
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.body && part.body.data) {
        if (part.mimeType && part.mimeType === "text/html") {
          body += stripHtml(decodeBase64Url(part.body.data));
        } else if (part.mimeType && part.mimeType === "text/plain") {
          body += decodeBase64Url(part.body.data);
        } else {
          body += decodeBase64Url(part.body.data);
        }
      }

      if (part.parts) {
        body += extractBody(part);
      }
    }
  }
  return body;
}

export async function downloadAttachments(
  gmail: any,
  messageId: string,
  parts: any[]
): Promise<string[]> {
  // Create "attachments" folder (if it doesn't exist)
  const attachmentsDir = path.join(process.cwd(), "attachments");
  await fs.mkdir(attachmentsDir, { recursive: true });

  const attachmentPaths: string[] = [];

  for (const part of parts) {
    // Check if the part is an attachment (has a filename and attachmentId)
    if (
      part.filename &&
      part.filename.length > 0 &&
      part.body &&
      part.body.attachmentId
    ) {
      const attachId = part.body.attachmentId;
      try {
        const attachRes = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId,
          id: attachId,
        });
        const { data } = attachRes.data;
        if (data) {
          // Gmail returns attachment data in base64url encoding.
          const buffer = Buffer.from(data, "base64");
          const filePath = path.join(attachmentsDir, part.filename);
          await fs.writeFile(filePath, buffer);
          console.log(filePath);

          attachmentPaths.push(filePath);
        }
      } catch (error) {
        console.error(`Error downloading attachment ${attachId}: ${error}`);
      }
    }
  }

  return attachmentPaths;
}
