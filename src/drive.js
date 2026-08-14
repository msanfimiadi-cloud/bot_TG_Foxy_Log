import { Readable } from "node:stream";
import { google } from "googleapis";

export class QuoteDriveStore {
  constructor(config, serviceAccountAuth) {
    this.config = config;
    let auth = serviceAccountAuth;
    if (config.driveOAuthClientId) {
      auth = new google.auth.OAuth2(
        config.driveOAuthClientId,
        config.driveOAuthClientSecret,
      );
      auth.setCredentials({ refresh_token: config.driveOAuthRefreshToken });
    }
    this.drive = google.drive({ version: "v3", auth });
  }

  async upload(buffer, filename) {
    if (!this.config.driveFolderId) throw new Error("Не задан GOOGLE_DRIVE_FOLDER_ID");
    const response = await this.drive.files.create({
      requestBody: {
        name: filename,
        parents: [this.config.driveFolderId],
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      media: {
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        body: Readable.from(buffer),
      },
      fields: "id,webViewLink",
    });
    if (this.config.driveShareWithLink) {
      await this.drive.permissions.create({
        fileId: response.data.id,
        requestBody: { role: "reader", type: "anyone" },
      });
    }
    return response.data.webViewLink || `https://drive.google.com/file/d/${response.data.id}/view`;
  }
}
