declare module "gif-encoder-2" {
  export default class GIFEncoder {
    constructor(width: number, height: number, algorithm?: "neuquant" | "octree", useOptimizer?: boolean, totalFrames?: number);

    setDelay(delay: number): void;
    setQuality(quality: number): void;
    setRepeat(repeat: number): void;
    setFrameRate(fps: number): void;
    setTransparent(color: number | string): void;

    start(): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addFrame(ctx: any): void;
    finish(): void;

    out: {
      getData(): Buffer;
    };
  }
}
