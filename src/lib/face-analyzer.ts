/**
 * Service to handle interaction with the Makeup VTO API.
 * Requirements: Next.js environment with FACE_ANALYZER_API_KEY in .env
 */

import {
  DEFAULT_MAKEUP_EFFECTS,
  PERFECT_ANALYZER_CONFIG,
  PERFECT_API_ENDPOINTS,
} from "./constants";

type AnalyzerStage =
  | "config"
  | "file-create"
  | "file-upload"
  | "task-create"
  | "task-poll"
  | "validation";

interface AnalyzerContext {
  requestId: string;
}

export class FaceAnalyzerError extends Error {
  code: string;
  stage: AnalyzerStage;
  requestId: string;
  statusCode?: number;

  constructor(params: {
    code: string;
    stage: AnalyzerStage;
    requestId: string;
    message: string;
    statusCode?: number;
  }) {
    super(params.message);
    this.name = "FaceAnalyzerError";
    this.code = params.code;
    this.stage = params.stage;
    this.requestId = params.requestId;
    this.statusCode = params.statusCode;
  }
}

interface TaskResponse {
  data?: {
    task_id?: string;
    task_status?: 'pending' | 'processing' | 'success' | 'error';
    results?: unknown;
  };
  status?: number;
}

interface FileApiResponse {
  data?: {
    files?: Array<{
      file_id: string;
      requests: Array<{
        url: string;
        method: string;
        headers: Record<string, string>;
      }>;
    }>;
  };
  files?: Array<{
    file_id: string;
    requests: Array<{
      url: string;
      method: string;
      headers: Record<string, string>;
    }>;
  }>;
  result?: {
    files: Array<{
      file_id: string;
      requests: Array<{
        url: string;
        method: string;
        headers: Record<string, string>;
      }>;
    }>;
  };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function logStage(
  level: "info" | "error",
  event: string,
  context: AnalyzerContext,
  extra?: Record<string, unknown>
) {
  const payload = { requestId: context.requestId, ...extra };
  if (level === "error") {
    console.error(`[FaceAnalyzer] ${event}`, payload);
    return;
  }
  console.log(`[FaceAnalyzer] ${event}`, payload);
}

function getApiKey(context: AnalyzerContext): string {
  const apiKey = process.env.FACE_ANALYZER_API_KEY;
  if (!apiKey) {
    throw new FaceAnalyzerError({
      code: "MISSING_API_KEY",
      stage: "config",
      requestId: context.requestId,
      message: "FACE_ANALYZER_API_KEY is not configured on the server.",
    });
  }
  return apiKey;
}

async function parseJsonResponse<T>(
  response: Response,
  context: AnalyzerContext,
  stage: AnalyzerStage
): Promise<T> {
  const responseText = await response.text();
  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new FaceAnalyzerError({
      code: "INVALID_JSON_RESPONSE",
      stage,
      requestId: context.requestId,
      message: `Received non-JSON response from API (${response.status}).`,
      statusCode: response.status,
    });
  }
}

/**
 * Step 1: Request a pre-signed upload URL from the API.
 */
async function getUploadInfo(fileSize: number): Promise<{
  fileId: string;
  uploadUrl: string;
  headers: Record<string, string>;
}> {
  const context: AnalyzerContext = { requestId: crypto.randomUUID() };
  return getUploadInfoWithContext(fileSize, context);
}

async function getUploadInfoWithContext(
  fileSize: number,
  context: AnalyzerContext
): Promise<{
  fileId: string;
  uploadUrl: string;
  headers: Record<string, string>;
}> {
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new FaceAnalyzerError({
      code: "INVALID_IMAGE_SIZE",
      stage: "validation",
      requestId: context.requestId,
      message: "Image buffer is empty or invalid.",
    });
  }

  const apiKey = getApiKey(context);

  logStage("info", "create_file.start", context, { fileSize });

  const response = await fetch(PERFECT_API_ENDPOINTS.file, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      files: [
        {
          content_type: PERFECT_ANALYZER_CONFIG.sourceContentType,
          file_name: PERFECT_ANALYZER_CONFIG.sourceFileName,
          file_size: fileSize,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new FaceAnalyzerError({
      code: "FILE_API_REQUEST_FAILED",
      stage: "file-create",
      requestId: context.requestId,
      statusCode: response.status,
      message: `File API request failed with status ${response.status}.`,
    });
  }

  const data = await parseJsonResponse<FileApiResponse>(
    response,
    context,
    "file-create"
  );

  // Handle cases where 'files' is at the root or wrapped in 'result'
  const fileInfo = data.data?.files?.[0] || data.files?.[0] || data.result?.files?.[0];

  if (!fileInfo || !fileInfo.requests?.[0]) {
    throw new FaceAnalyzerError({
      code: "FILE_API_INVALID_RESPONSE",
      stage: "file-create",
      requestId: context.requestId,
      message: "File API response did not include file_id and upload request data.",
    });
  }

  logStage("info", "create_file.success", context, {
    fileId: fileInfo.file_id,
    method: fileInfo.requests[0].method,
  });

  return {
    fileId: fileInfo.file_id,
    uploadUrl: fileInfo.requests[0].url,
    headers: fileInfo.requests[0].headers,
  };
}

/**
 * Step 2: Upload the binary image data to the pre-signed URL.
 */
async function uploadBinary(
  url: string,
  headers: Record<string, string>,
  imageBuffer: Buffer,
  context: AnalyzerContext
): Promise<void> {
  logStage("info", "upload_binary.start", context);

  const response = await fetch(url, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': PERFECT_ANALYZER_CONFIG.sourceContentType },
    body: imageBuffer as any
  });

  if (!response.ok) {
    throw new FaceAnalyzerError({
      code: "BINARY_UPLOAD_FAILED",
      stage: "file-upload",
      requestId: context.requestId,
      statusCode: response.status,
      message: `Binary upload failed with status ${response.status}.`,
    });
  }

  logStage("info", "upload_binary.success", context);
}

/**
 * Step 3: Starts the AI face analysis task.
 */
async function startTask(fileId: string, context: AnalyzerContext): Promise<string> {
  const apiKey = getApiKey(context);

  logStage("info", "create_task.start", context, { fileId });

  const response = await fetch(PERFECT_API_ENDPOINTS.task, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      "src_file_id": fileId,
      "effects": DEFAULT_MAKEUP_EFFECTS,
      "version": PERFECT_ANALYZER_CONFIG.apiVersion
    })
  });

  if (!response.ok) {
    throw new FaceAnalyzerError({
      code: "TASK_CREATE_FAILED",
      stage: "task-create",
      requestId: context.requestId,
      statusCode: response.status,
      message: `Task creation failed with status ${response.status}.`,
    });
  }
  
  const json = await parseJsonResponse<TaskResponse>(response, context, "task-create");
  const taskId = json.data?.task_id;
  
  if (!taskId) {
    throw new FaceAnalyzerError({
      code: "TASK_ID_MISSING",
      stage: "task-create",
      requestId: context.requestId,
      message: "Task API response did not include task_id.",
    });
  }

  logStage("info", "create_task.success", context, { taskId });
  return taskId;
}

/**
 * Polls the API until the task is complete.
 */
async function pollTask(taskId: string, context: AnalyzerContext): Promise<unknown> {
  const apiKey = getApiKey(context);

  const maxAttempts = PERFECT_ANALYZER_CONFIG.polling.maxAttempts;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(`${PERFECT_API_ENDPOINTS.task}/${encodeURIComponent(taskId)}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new FaceAnalyzerError({
        code: "TASK_POLL_FAILED",
        stage: "task-poll",
        requestId: context.requestId,
        statusCode: response.status,
        message: `Polling failed with status ${response.status}.`,
      });
    }

    const json = await parseJsonResponse<TaskResponse>(response, context, "task-poll");
    const status = json.data?.task_status;

    logStage("info", "poll_task.attempt", context, {
      attempt,
      maxAttempts,
      taskId,
      status: status ?? "unknown",
    });

    if (status === 'success') return json.data?.results;
    if (status === 'error') {
      throw new FaceAnalyzerError({
        code: "TASK_FAILED_REMOTE",
        stage: "task-poll",
        requestId: context.requestId,
        message: "Task failed on remote API.",
      });
    }

    // Wait 2 seconds before next poll
    await sleep(PERFECT_ANALYZER_CONFIG.polling.intervalMs);
  }
  throw new FaceAnalyzerError({
    code: "TASK_POLL_TIMEOUT",
    stage: "task-poll",
    requestId: context.requestId,
    message: "Polling timed out before task completion.",
  });
}

/**
 * Orchestrates the full 3-step upload and analysis flow.
 */
export async function runFaceAnalysis(
  imageBuffer: Buffer,
  context: AnalyzerContext = { requestId: crypto.randomUUID() }
) {
  logStage("info", "analysis.start", context, { imageBytes: imageBuffer.length });

  try {
    // 1. Get pre-signed URL
    const { fileId, uploadUrl, headers } = await getUploadInfoWithContext(
      imageBuffer.length,
      context
    );

    // 2. Upload binary
    await uploadBinary(uploadUrl, headers, imageBuffer, context);

    // 3. Process and Poll
    const taskId = await startTask(fileId, context);
    const results = await pollTask(taskId, context);
    logStage("info", "analysis.success", context, { taskId });
    return results;
  } catch (error) {
    if (error instanceof FaceAnalyzerError) {
      logStage("error", "analysis.failed", context, {
        code: error.code,
        stage: error.stage,
        statusCode: error.statusCode ?? null,
        message: error.message,
      });
      throw error;
    }

    const wrapped = new FaceAnalyzerError({
      code: "ANALYSIS_UNEXPECTED_ERROR",
      stage: "validation",
      requestId: context.requestId,
      message: "Unexpected error while running face analysis.",
    });
    logStage("error", "analysis.failed_unexpected", context, {
      message: error instanceof Error ? error.message : "unknown",
    });
    throw wrapped;
  }
}