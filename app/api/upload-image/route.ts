import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const perfectCorpBaseUrl =
      process.env.PERFECTCORP_API_BASE_URL ??
      process.env.PERFECTCORP_BASE_URL ??
      process.env.PERFECTCORP_API_URL;

    if (!perfectCorpBaseUrl) {
      return NextResponse.json(
        {
          error:
            "Missing PerfectCorp API base URL. Set PERFECTCORP_API_BASE_URL in .env.local.",
        },
        { status: 500 },
      );
    }
//https://yce-api-01.makeupar.com/s2s/v2.0/file/skin-analysis
///s2s/v1.0/file
    const fileApiUrl = new URL("/s2s/v2.0/file/skin-analysis", perfectCorpBaseUrl);
    
    // Determine file metadata, handling both File objects and strings (e.g. Data URLs)
    const isBlob = file instanceof Blob;
    const fileSize = isBlob ? file.size : (file as string).length;
    const contentType = (isBlob ? file.type : "") || "image/jpeg";
    const fileName = (isBlob ? (file as File).name : "") || "face.jpg";

    const fileApiRes = await fetch(fileApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PERFECTCORP_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: [
          {
            content_type: contentType,
            file_name: fileName,
            file_size: fileSize,
          },
        ],
      }),
    });

    if (!fileApiRes.ok) {
      const error = await fileApiRes.text();
      console.log("*** 3a. Error ", error)
      return NextResponse.json({ error }, { status: fileApiRes.status });
    }

    const data = await fileApiRes.json();
    // Use JSON.stringify to print the full nested object

    // Extract files array handling the nested structure shown in your logs
    const files = data.data?.files ?? data.files;
    
    if (!files || !files[0]) {
      throw new Error("Invalid response from File API: files array missing");
    }

    const { file_id, requests } = files[0];
    
    const uploadRequest = requests[0];

    const uploadHeaders: Record<string, string> = {};
    if (uploadRequest.headers) {
      Object.entries(uploadRequest.headers).forEach(([key, value]) => {
        uploadHeaders[key] = value as string;
      });
    }

    const uploadRes = await fetch(uploadRequest.url, {
      method: uploadRequest.method || "PUT",
      headers: uploadHeaders,
      body: file,
    });

    if (!uploadRes.ok) {
      const error = await uploadRes.text();
      return NextResponse.json({ error: `Upload failed: ${error}` }, { status: 500 });
    }
    return NextResponse.json({ file_id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}