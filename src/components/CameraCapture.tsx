"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { processSelfie } from '../lib/face-analysis';

interface CameraCaptureProps {
  onCapture: (results: unknown) => void;
  onClose: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Failed to analyze face.";
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    
    async function setupCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API not supported in this browser");
        }

        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'user', // Front camera
            width: { ideal: 1280 }, // Request ideal resolution
            height: { ideal: 720 }
          } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: unknown) {
        console.error("Error accessing camera:", err);
        setError(getErrorMessage(err) || "Could not access camera. Please check permissions.");
      }
    }
    
    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) {
      setError("Camera or canvas not ready.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Draw the current video frame to the canvas
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match video stream
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error("Could not get canvas context.");
      }

      // Mirror the capture to match the mirrored preview experience
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get image data as Base64
      const imageData = canvas.toDataURL('image/jpeg', 0.9); // Adjust quality as needed
      const results = await processSelfie(imageData);
      onCapture(results);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  }, [onCapture]);

  return ( // The main container for the full-screen camera
    <div className="fixed inset-0 bg-black z-[100] flex flex-col h-[100dvh] w-screen overflow-hidden">
      {/* Video Stream background */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }} // Mirroring the preview
      />

      {/* Hidden Canvas for image capture */}
      <canvas
        ref={canvasRef}
        className="hidden" // Keep it hidden
        aria-hidden="true"
      />

      {/* UI Overlay Layer */}
      <div className="relative flex-1 flex flex-col justify-between p-6 z-10 pointer-events-none">
        {/* Top Bar: Close Button */}
        <div className="flex justify-end pointer-events-auto">
          <button
            onClick={onClose}
            className="p-2 bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors focus:outline-none"
            aria-label="Close camera"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Bottom Bar: Blue Pill Capture Button */}
        <div className="flex flex-col items-center gap-4 mb-8 pointer-events-auto">
          {error && (
            <div className="bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm max-w-xs text-center shadow-xl">
              {error}
            </div>
          )}
          <button
            onClick={handleCapture}
            disabled={isProcessing}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-10 rounded-full shadow-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          >
            Take Selfie
          </button>
        </div>
      </div>

      {/* Processing Spinner Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center z-[110] backdrop-blur-sm">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-white/20 border-t-white mb-4"></div>
          <p className="text-white text-xl font-semibold tracking-wide">Processing...</p>
        </div>
      )}
    </div>
  );
}