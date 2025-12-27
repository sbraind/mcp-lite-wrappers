import GIFEncoder from "gif-encoder-2";
import { createCanvas, loadImage, CanvasRenderingContext2D as NodeCanvasContext } from "canvas";

export interface Frame {
  screenshot: Buffer;
  timestamp: number;
  action?: string;
  coordinates?: { x: number; y: number };
}

export interface GifExportOptions {
  showClickIndicators?: boolean;
  showActionLabels?: boolean;
  showProgressBar?: boolean;
  quality?: number;
  delay?: number;
}

class GifRecorder {
  private frames: Frame[] = [];
  private isRecording = false;
  private captureOnAction = true;
  private width = 0;
  private height = 0;

  start(options: { captureOnAction?: boolean } = {}): { success: boolean; message: string } {
    this.frames = [];
    this.isRecording = true;
    this.captureOnAction = options.captureOnAction ?? true;
    return { success: true, message: "GIF recording started" };
  }

  stop(): { success: boolean; frameCount: number } {
    this.isRecording = false;
    return { success: true, frameCount: this.frames.length };
  }

  isActive(): boolean {
    return this.isRecording;
  }

  shouldCaptureOnAction(): boolean {
    return this.isRecording && this.captureOnAction;
  }

  async addFrame(
    screenshot: Buffer,
    action?: string,
    coordinates?: { x: number; y: number }
  ): Promise<void> {
    if (!this.isRecording) return;

    // Get dimensions from first frame
    if (this.frames.length === 0) {
      const img = await loadImage(screenshot);
      this.width = img.width;
      this.height = img.height;
    }

    this.frames.push({
      screenshot,
      timestamp: Date.now(),
      action,
      coordinates,
    });
  }

  async export(options: GifExportOptions = {}): Promise<{ gif: Buffer; frameCount: number }> {
    if (this.frames.length === 0) {
      throw new Error("No frames to export. Start recording and perform some actions first.");
    }

    const {
      showClickIndicators = true,
      showActionLabels = true,
      showProgressBar = true,
      quality = 10,
      delay = 500,
    } = options;

    const encoder = new GIFEncoder(this.width, this.height, "neuquant");
    encoder.setDelay(delay);
    encoder.setQuality(quality);
    encoder.start();

    for (let i = 0; i < this.frames.length; i++) {
      const frame = this.frames[i];
      const canvas = createCanvas(this.width, this.height);
      const ctx = canvas.getContext("2d");

      // Draw screenshot
      const img = await loadImage(frame.screenshot);
      ctx.drawImage(img, 0, 0);

      // Draw click indicator (orange circle)
      if (showClickIndicators && frame.coordinates) {
        this.drawClickIndicator(ctx, frame.coordinates);
      }

      // Draw action label (black label at top)
      if (showActionLabels && frame.action) {
        this.drawActionLabel(ctx, frame.action);
      }

      // Draw progress bar (orange bar at bottom)
      if (showProgressBar) {
        this.drawProgressBar(ctx, i, this.frames.length);
      }

      encoder.addFrame(ctx as unknown as CanvasRenderingContext2D);
    }

    encoder.finish();
    const gif = encoder.out.getData();

    return { gif, frameCount: this.frames.length };
  }

  clear(): { success: boolean } {
    this.frames = [];
    this.isRecording = false;
    this.width = 0;
    this.height = 0;
    return { success: true };
  }

  getFrameCount(): number {
    return this.frames.length;
  }

  private drawClickIndicator(
    ctx: NodeCanvasContext,
    coordinates: { x: number; y: number }
  ): void {
    const { x, y } = coordinates;

    // Outer circle (orange)
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.strokeStyle = "#FF6B00";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner circle (orange, semi-transparent)
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 107, 0, 0.5)";
    ctx.fill();
  }

  private drawActionLabel(
    ctx: NodeCanvasContext,
    action: string
  ): void {
    const padding = 10;
    const fontSize = 14;

    ctx.font = `bold ${fontSize}px sans-serif`;
    const textMetrics = ctx.measureText(action);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(padding, padding, textWidth + 20, textHeight + 10);

    // Text
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(action, padding + 10, padding + textHeight + 2);
  }

  private drawProgressBar(
    ctx: NodeCanvasContext,
    currentFrame: number,
    totalFrames: number
  ): void {
    const barHeight = 4;
    const progress = (currentFrame + 1) / totalFrames;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, this.height - barHeight, this.width, barHeight);

    // Progress
    ctx.fillStyle = "#FF6B00";
    ctx.fillRect(0, this.height - barHeight, this.width * progress, barHeight);
  }
}

// Singleton instance
export const gifRecorder = new GifRecorder();
