# AR Try-on canvas & Perfect Corp SDK wrappers

## CameraCapture Component

The `CameraCapture` component is a specialized React client component designed to facilitate selfie taking for skin analysis and AR features.

### How it Works

1.  **Media Stream Initialization**: 
    Upon mounting, the component uses the `navigator.mediaDevices.getUserMedia` API to request access to the device's camera. It specifically requests the `user` facing mode to ensure the front-facing camera is used.
    
2.  **Live Preview & Mirroring**:
    The active `MediaStream` is attached to a `<video>` element. To provide a natural "mirror-like" selfie experience, the video feed is visually flipped using CSS (`transform: scaleX(-1)`).
    
3.  **Image Processing**:
    When the user triggers a capture:
    - An off-screen `<canvas>` element is dynamically sized to match the video's intrinsic dimensions.
    - The canvas context is transformed and scaled to replicate the mirroring effect of the preview.
    - The current frame from the video stream is drawn onto the canvas.
    - The result is exported as a Base64 encoded PNG string.

4.  **Resource Cleanup**:
    To prevent memory leaks and keep the device's camera "in use" indicator from staying active, the component includes a cleanup effect. When it unmounts, it iterates through all active media tracks in the stream and stops them.

### Usage

```tsx
import CameraCapture from './CameraCapture';

const MyPage = () => {
  return <CameraCapture onCapture={(image) => console.log('Captured!', image)} />;
};
```