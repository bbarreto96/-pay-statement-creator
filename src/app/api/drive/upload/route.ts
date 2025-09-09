import { google } from "googleapis";
import { NextRequest } from "next/server";
import fs from "node:fs/promises";

// Node.js runtime route (not Edge) because we use googleapis
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
	try {
		const form = await req.formData();
		const file = form.get("file") as File | null;
		const filename = (form.get("filename") as string) || "pay-statement.pdf";
		const contractorName =
			(form.get("contractorName") as string) || "Contractor";
		const allowCreate = (form.get("allowCreate") as string) ?? "true";

		if (!file) {
			return new Response(JSON.stringify({ error: "file is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const parentFolderId = process.env.DRIVE_PARENT_FOLDER_ID;
		const clientEmail = process.env.GDRIVE_SERVICE_ACCOUNT_EMAIL;
		let privateKey = process.env.GDRIVE_PRIVATE_KEY;
		const keyFilePath = process.env.GDRIVE_KEYFILE_PATH;

		if (!parentFolderId) {
			return new Response(
				JSON.stringify({ error: "Missing DRIVE_PARENT_FOLDER_ID" }),
				{ status: 500, headers: { "Content-Type": "application/json" } }
			);
		}

		if (!clientEmail || !privateKey) {
			if (keyFilePath) {
				try {
					const keyJsonRaw = await fs.readFile(keyFilePath, "utf8");
					const keyJson = JSON.parse(keyJsonRaw);
					privateKey = keyJson.private_key;
					// Optional: allow overriding client_email from file
					if (!clientEmail && keyJson.client_email) {
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(process.env as any).GDRIVE_SERVICE_ACCOUNT_EMAIL =
							keyJson.client_email;
					}
				} catch (e) {
					return new Response(
						JSON.stringify({ error: `Failed to read keyfile: ${String(e)}` }),
						{ status: 500, headers: { "Content-Type": "application/json" } }
					);
				}
			} else {
				return new Response(
					JSON.stringify({
						error:
							"Missing Drive credentials. Set GDRIVE_SERVICE_ACCOUNT_EMAIL and GDRIVE_PRIVATE_KEY, or provide GDRIVE_KEYFILE_PATH to the JSON key file.",
					}),
					{ status: 500, headers: { "Content-Type": "application/json" } }
				);
			}
		}

		// Handle escaped \n in env vars if present
		if (privateKey) {
			privateKey = privateKey.replace(/\\n/g, "\n");
		}

		const auth = new google.auth.JWT({
			email: process.env.GDRIVE_SERVICE_ACCOUNT_EMAIL as string,
			key: privateKey as string,
			scopes: ["https://www.googleapis.com/auth/drive"],
		});

		const drive = google.drive({ version: "v3", auth });

		// 1) Find or create subfolder under parent matching contractorName
		const supportsAllDrives = true;
		const includeItemsFromAllDrives = true;
		const corpora = "allDrives"; // search user + shared drives

		const folderQuery = [
			`'${parentFolderId}' in parents`,
			"mimeType = 'application/vnd.google-apps.folder'",
			"trashed = false",
			`name = '${contractorName.replace(/'/g, "\\'")}'`,
		].join(" and ");

		const listRes = await drive.files.list({
			q: folderQuery,
			fields: "files(id, name)",
			includeItemsFromAllDrives,
			supportsAllDrives,
			corpora,
			pageSize: 10,
		});

		let targetFolderId: string | undefined =
			(listRes.data.files?.[0]?.id as string) || undefined;

		if (!targetFolderId) {
			if (allowCreate === "true") {
				const createFolderRes = await drive.files.create({
					requestBody: {
						name: contractorName,
						mimeType: "application/vnd.google-apps.folder",
						parents: [parentFolderId],
					},
					fields: "id, name",
					supportsAllDrives,
				});
				targetFolderId = createFolderRes.data.id ?? undefined;
			} else {
				return new Response(
					JSON.stringify({ error: "Folder not found for contractor" }),
					{ status: 404, headers: { "Content-Type": "application/json" } }
				);
			}
		}

		if (!targetFolderId) {
			return new Response(
				JSON.stringify({ error: "Failed to resolve or create target folder" }),
				{ status: 500, headers: { "Content-Type": "application/json" } }
			);
		}

		// 2) Upload file to target folder
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		const uploadRes = await drive.files.create({
			requestBody: {
				name: filename,
				parents: [targetFolderId],
				mimeType: "application/pdf",
			},
			media: {
				mimeType: "application/pdf",
				body: ReadableStreamFromBuffer(buffer),
			},
			fields: "id, name, webViewLink, webContentLink",
			supportsAllDrives,
		});

		return new Response(
			JSON.stringify({
				id: uploadRes.data.id,
				name: uploadRes.data.name,
				webViewLink: uploadRes.data.webViewLink,
				webContentLink: uploadRes.data.webContentLink,
				folderId: targetFolderId,
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } }
		);
	} catch (error) {
		console.error("Drive upload error:", error);
		const message = error instanceof Error ? error.message : String(error);
		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}

// Helper: create a Node Readable from Buffer compatible with googleapis
import { Readable } from "stream";
function ReadableStreamFromBuffer(buf: Buffer) {
	const stream = new Readable();
	stream.push(buf);
	stream.push(null);
	return stream;
}
