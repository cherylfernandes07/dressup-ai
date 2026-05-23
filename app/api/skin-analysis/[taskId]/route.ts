import { NextResponse } from "next/server";

type NormalizedStatus = "pending" | "processing" | "success" | "error";

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

function normalizeTaskStatus(status?: string): NormalizedStatus {
  const value = (status ?? "").toLowerCase();

  if (["success", "succeeded", "complete", "completed", "done"].includes(value)) {
    return "success";
  }

  if (["error", "failed", "failure", "canceled", "cancelled"].includes(value)) {
    return "error";
  }

  if (["processing", "running", "in_progress", "in-progress"].includes(value)) {
    return "processing";
  }

  return "pending";
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ taskId: string }> | { taskId: string } },
) {
  try {
    const { taskId } = await Promise.resolve(context.params);

    if (!taskId || typeof taskId !== "string") {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

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

    const taskApiUrl = new URL(
      `/s2s/v2.0/task/skin-analysis/${encodeURIComponent(taskId)}`,
      perfectCorpBaseUrl,
    );

    const response = await fetch(taskApiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error: error || "Failed to poll analysis task" }, { status: 502 });
    }

    const data = await response.json();
    const rawStatus = data?.data?.task_status ?? data?.task_status;
    const normalizedStatus = normalizeTaskStatus(rawStatus);
    const resultPayload = data?.data?.results ?? data?.results ?? null;
    const resultUrl =
      data?.data?.result_url ??
      data?.result_url ??
      (resultPayload && typeof resultPayload === "object"
        ? (resultPayload as { result_url?: string }).result_url
        : undefined);

    return NextResponse.json({
      task_id: taskId,
      task_status: normalizedStatus,
      ...(resultPayload ? { result: resultPayload } : {}),
      ...(resultUrl ? { result_url: resultUrl } : {}),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to poll analysis task" },
      { status: 500 },
    );
  }
}