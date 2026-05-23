'use client';

import { useState, useCallback } from 'react';
import CameraCapture from "../src/components/CameraCapture";

export default function Home() {
  const [showCamera, setShowCamera] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCapture = useCallback(async (imageBlob: any) => {
    setStatus('uploading');
    setShowCamera(false);
    setErrorMsg(null);

    try {
      // STEP 2: Upload image (via proxy)
      const formData = new FormData();
      formData.append('file', imageBlob);

      const uploadRes = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('Upload failed');
      const { file_id } = await uploadRes.json();

      // STEP 3: Initiate AI Task
      const payload = {
        src_file_id: file_id,
        file_id: file_id,
        dst_actions: [
          'hd_wrinkle',
          'hd_pore',
          'hd_texture',
        ],
      };


      setStatus('analyzing');
      const analysisRes = await fetch('/api/skin-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log("*** A analysisRes ", analysisRes)

      if (!analysisRes.ok) throw new Error('Failed to initiate analysis');
      const { task_id } = await analysisRes.json();

      // STEP 4: Poll Task Status
      let finalResult = null;
      let attempts = 0;
      const maxAttempts = 30; // ~60 seconds timeout

      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000));

        const pollRes = await fetch(`/api/skin-analysis/${task_id}`);
        const pollData = await pollRes.json();

        if (pollData.task_status === 'success') {
          finalResult = pollData;
          break;
        }

        if (pollData.task_status === 'error') {
          throw new Error('Analysis task failed on server');
        }

        attempts++;
      }

      if (!finalResult) throw new Error('Analysis timed out');

      setResult(finalResult);
      setStatus('done');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Something went wrong');
      setStatus('error');
    }
  }, []);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
        {status === 'idle' && !showCamera && (
           <button 
             onClick={() => setShowCamera(true)}
             className="px-6 py-3 bg-blue-600 text-white rounded-full font-semibold"
           >
             Open Analysis Camera
           </button>
        )}

        {showCamera && (
           <CameraCapture 
             onCapture={handleCapture} 
             onClose={() => setShowCamera(false)} 
           />
        )}

        {(status === 'uploading' || status === 'analyzing') && (
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-zinc-500 capitalize">{status}...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <p className="text-red-500 mb-4">{errorMsg}</p>
            <button onClick={() => setShowCamera(true)} className="text-blue-600 underline">Try again</button>
          </div>
        )}

        {status === 'done' && result && (
          <div className="w-full">
            <h2 className="text-2xl font-bold mb-4">Analysis Results</h2>
            <div className="bg-zinc-100 p-4 rounded overflow-auto max-h-96 text-xs dark:bg-zinc-900">
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </div>
            {result.result_url && (
              <img src={result.result_url} alt="Skin Analysis Result" className="mt-4 rounded-lg shadow-lg w-full" />
            )}
            <button 
              onClick={() => { setStatus('idle'); setResult(null); }}
              className="mt-6 px-4 py-2 bg-zinc-200 rounded-lg dark:bg-zinc-800"
            >
              Start Over
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
  