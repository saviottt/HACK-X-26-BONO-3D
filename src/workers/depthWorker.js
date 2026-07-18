import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0/+esm';

// Skip local model check since we are running in the browser
env.allowLocalModels = false;

// We use a singleton pattern for the pipeline
class PipelineSingleton {
  static task = 'depth-estimation';
  static model = 'Xenova/depth-anything-small-hf';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const { type, image, resolution } = event.data;

  if (type === 'init') {
    // Start loading the model immediately
    try {
      await PipelineSingleton.getInstance((x) => {
        self.postMessage({ type: 'progress', data: x });
      });
      self.postMessage({ type: 'ready' });
    } catch (e) {
      self.postMessage({ type: 'error', error: e.message });
    }
  } else if (type === 'process') {
    try {
      self.postMessage({ type: 'status', status: 'Generating AI depth map...' });
      
      const estimator = await PipelineSingleton.getInstance();
      const result = await estimator(image);
      
      // result.depth is a raw tensor. For depth-anything, we usually get an image out.
      // The output object from depth-estimation pipeline usually has: { depth, predicted_depth }
      // depth is a RawImage, predicted_depth is a Tensor
      
      // We will send back the raw depth tensor (Float32Array)
      let depthData;
      let width;
      let height;

      if (result.depth) {
        depthData = result.depth.data;
        width = result.depth.width;
        height = result.depth.height;
      } else {
        throw new Error('No depth found in the model output');
      }
      
      self.postMessage({
        type: 'complete',
        depthMap: depthData,
        width,
        height,
      });

    } catch (error) {
      self.postMessage({ type: 'error', error: error.message });
    }
  }
});
