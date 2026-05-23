'use client';

import React, { useEffect, useRef, useState } from 'react';

interface CameraCaptureProps {
  /** Callback function triggered when a photo is captured. Returns a Base64 string. */
  onCapture: (imageData: string) => void;
}

/**
 * CameraCapture component for taking selfies.
 * Handles camera permissions, live preview mirroring, and image processing.
 */
const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'user', // Request front-facing camera
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false,
        });

        currentStream = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsStreaming(true);
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("Camera access denied or hardware not found. Please check browser permissions.");
      }
    };

    startCamera();

    // Cleanup: stop all tracks when component unmounts to release the camera
    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const takeSelfie = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video && canvas && isStreaming) {
      const context = canvas.getContext('2d');
      if (context) {
        // Sync canvas dimensions with video stream
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Mirror the capture to match the preview experience
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/png');
        onCapture(dataUrl);
      }
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700">
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden mb-6 shadow-inner border border-gray-300 dark:border-gray-600">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <p className="text-red-500 font-medium mb-2">Camera Error</p>
            <p className="text-sm text-gray-400">{error}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }} // Mirroring the preview
          />
        )}
        
        {!isStreaming && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <button
        onClick={takeSelfie}
        disabled={!isStreaming}
        className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-full transition-all transform active:scale-95 shadow-lg flex items-center gap-2"
      >
        Take Selfie
      </button>
    </div>
  );
};

export default CameraCapture;