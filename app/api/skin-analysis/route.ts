import { NextResponse } from "next/server";

function getPerfectCorpBaseUrl() {
	return (
		process.env.PERFECTCORP_API_BASE_URL ??
		process.env.PERFECTCORP_BASE_URL ??
		process.env.PERFECTCORP_API_URL
	);
}

function getApiKey() {
	return process.env.PERFECTCORP_API_KEY ?? process.env.FACE_ANALYZER_API_KEY;
}

export async function POST(req: Request) {
	try {
		const perfectCorpBaseUrl = getPerfectCorpBaseUrl();
		const apiKey = getApiKey();

		if (!perfectCorpBaseUrl) {
			return NextResponse.json(
				{
					error:
						"Missing PerfectCorp API base URL. Set PERFECTCORP_API_BASE_URL in .env.local.",
				},
				{ status: 500 },
			);
		}

		if (!apiKey) {
			return NextResponse.json(
				{ error: "Missing PERFECTCORP_API_KEY in .env.local." },
				{ status: 500 },
			);
		}


        

		const body = await req.json().catch(() => null);
        console.log("*** Inside skin-analysis POST ", req, body)
		const fileId = body?.file_id;

		if (!fileId || typeof fileId !== "string") {
			return NextResponse.json({ error: "file_id is required" }, { status: 400 });
		}

		const taskApiUrl = new URL("/s2s/v2.0/task/skin-analysis", perfectCorpBaseUrl);

		const response = await fetch(taskApiUrl, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				src_file_id: fileId,
                file_id: fileId,
                dst_actions: body?.dst_actions
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			return NextResponse.json({ error: error || "Failed to create analysis task" }, { status: 502 });
		}

		const data = await response.json();
		const taskId = data?.data?.task_id ?? data?.task_id;

		if (!taskId || typeof taskId !== "string") {
			return NextResponse.json({ error: "Task API response did not include task_id." }, { status: 502 });
		}

		return NextResponse.json({ task_id: taskId, task_status: "pending" });
	} catch (err: any) {
		return NextResponse.json(
			{ error: err?.message || "Failed to create analysis task" },
			{ status: 500 },
		);
	}
}
