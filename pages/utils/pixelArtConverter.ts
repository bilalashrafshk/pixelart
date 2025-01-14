export async function photoToPixelArt(
  imageUrl: string,
  gridSize: number,
  edgeThresh: number,
  edgeDilate: number,
  palette: [number, number, number][],
): Promise<ImageData> {
  // Load the image from the URL
  const image = await loadImage(imageUrl);

  // Convert the image to ImageData
  const imageData = createImageDataFromImage(image);

  // Apply pixelation
  const pixelatedImage = createPixelEffect(imageData, gridSize, palette);

  // Detect edges
  const edgeImage = applyEdgeDetection(pixelatedImage, edgeThresh, edgeDilate);

  // Merge edges and pixelated image
  const { width, height, data: pixelData } = pixelatedImage;
  const { data: edgeData } = edgeImage;
  const output = new ImageData(width, height);

  for (let i = 0; i < pixelData.length; i += 4) {
    output.data[i] = edgeData[i] > 0 ? 0 : pixelData[i]; // Edge pixels as black
    output.data[i + 1] = edgeData[i + 1] > 0 ? 0 : pixelData[i + 1];
    output.data[i + 2] = edgeData[i + 2] > 0 ? 0 : pixelData[i + 2];
    output.data[i + 3] = 255; // Fully opaque
  }

  return output;
}

// Helper function to load an image from a URL
async function loadImage(imageUrl: string): Promise<Image> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = imageUrl;
  });
}

// Helper function to create ImageData from an Image object
function createImageDataFromImage(image: Image): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context");
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// Apply pixelation with quantized colors
function createPixelEffect(
  imageData: ImageData,
  gridSize: number,
  palette: [number, number, number][],
): ImageData {
  const { width, height, data } = imageData;
  const output = new ImageData(width, height);

  const cellWidth = Math.ceil(width / gridSize);
  const cellHeight = Math.ceil(height / gridSize);

  for (let gridY = 0; gridY < gridSize; gridY++) {
    for (let gridX = 0; gridX < gridSize; gridX++) {
      const startX = gridX * cellWidth;
      const startY = gridY * cellHeight;
      const [avgR, avgG, avgB] = getAverageColor(
        imageData,
        startX,
        startY,
        cellWidth,
        cellHeight,
      );

      // Quantize the color to the nearest color in the palette
      const [quantR, quantG, quantB] = findClosestPaletteColor(
        [avgR, avgG, avgB],
        palette,
      );

      // Fill the grid cell with the quantized color
      for (let y = startY; y < Math.min(startY + cellHeight, height); y++) {
        for (let x = startX; x < Math.min(startX + cellWidth, width); x++) {
          const i = (y * width + x) * 4;
          output.data[i] = quantR;
          output.data[i + 1] = quantG;
          output.data[i + 2] = quantB;
          output.data[i + 3] = 255; // Fully opaque
        }
      }
    }
  }

  return output;
}

// Get average color of a grid cell
function getAverageColor(
  imageData: ImageData,
  startX: number,
  startY: number,
  cellWidth: number,
  cellHeight: number,
): [number, number, number] {
  const { width, height, data } = imageData;
  let totalR = 0,
    totalG = 0,
    totalB = 0,
    count = 0;

  for (let y = startY; y < Math.min(startY + cellHeight, height); y++) {
    for (let x = startX; x < Math.min(startX + cellWidth, width); x++) {
      const i = (y * width + x) * 4;
      totalR += data[i];
      totalG += data[i + 1];
      totalB += data[i + 2];
      count++;
    }
  }

  return [
    Math.round(totalR / count),
    Math.round(totalG / count),
    Math.round(totalB / count),
  ];
}

// Find the closest color in the palette
function findClosestPaletteColor(
  [r, g, b]: [number, number, number],
  palette: [number, number, number][],
): [number, number, number] {
  let closestColor = palette[0];
  let minDistance = Infinity;

  for (const [pr, pg, pb] of palette) {
    const distance = Math.sqrt(
      Math.pow(pr - r, 2) + Math.pow(pg - g, 2) + Math.pow(pb - b, 2),
    );
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = [pr, pg, pb];
    }
  }

  return closestColor;
}

// Apply edge detection (same as before)
function applyEdgeDetection(
  imageData: ImageData,
  edgeThresh: number,
  edgeDilate: number,
): ImageData {
  // Same implementation as provided earlier
  // Sobel edge detection with dilation
  const { width, height, data } = imageData;
  const output = new ImageData(width, height);

  // Sobel kernels
  const kernelH = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1],
  ];
  const kernelV = [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1],
  ];

  const convolve = (x: number, y: number, kernel: number[][]): number => {
    let sum = 0;
    for (let ky = -1; ky <= 1; ky++) {
      for (let kx = -1; kx <= 1; kx++) {
        const nx = x + kx;
        const ny = y + ky;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const i = (ny * width + nx) * 4;
          const intensity = (data[i] + data[i + 1] + data[i + 2]) / 3;
          sum += intensity * kernel[ky + 1][kx + 1];
        }
      }
    }
    return sum;
  };

  const edges = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gradH = convolve(x, y, kernelH);
      const gradV = convolve(x, y, kernelV);
      edges[y * width + x] = Math.sqrt(gradH ** 2 + gradV ** 2);
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const magnitude = edges[y * width + x];
      const isEdge = magnitude > edgeThresh ? 255 : 0;

      // Dilate edges
      let maxVal = 0;
      for (
        let dy = -Math.floor(edgeDilate / 2);
        dy <= Math.floor(edgeDilate / 2);
        dy++
      ) {
        for (
          let dx = -Math.floor(edgeDilate / 2);
          dx <= Math.floor(edgeDilate / 2);
          dx++
        ) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            maxVal = Math.max(
              maxVal,
              edges[ny * width + nx] > edgeThresh ? 255 : 0,
            );
          }
        }
      }

      const finalEdge = maxVal > 0 ? 0 : isEdge;
      output.data[i] = finalEdge;
      output.data[i + 1] = finalEdge;
      output.data[i + 2] = finalEdge;
      output.data[i + 3] = 255; // Fully opaque
    }
  }

  return output;
}
