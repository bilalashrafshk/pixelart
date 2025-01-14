import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import GalleryModal from "./GalleryModal";
import { supabase } from "../lib/db";
import { SketchPicker } from "react-color";
const edgeThresh = 128;
const edgeDilate = 3;
const GRID_SIZES = [16, 32, 64, 128, 256, 512];
const TOOLS = ["draw", "erase", "fill"];
const COLORS = [
  "#ff3e3e",
  "#ff7f00",
  "#ffd700",
  "#00ff00",
  "#00ffff",
  "#0000ff",
  "#8b00ff",
  "#ffffff",
  "#000000",
  "#808080",
  "#a52a2a",
  "#ffa500",
  "#ffff00",
  "#008000",
  "#4b0082",
  "#ee82ee",
  "#ffc0cb",
  "#800000",
  "#008080",
  "#800080",
];

const PREDEFINED_ART = [
  {
    name: "FB Logo",
    url: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screen%20Shot%202025-01-13%20at%206.41.14%20PM-ER8gD2c2C0fGvn39eevCO4UVXlDrIv.png",
  },
  { name: "Fan Art", url: "/images/fanartfrombosu.png" },
];

const FinalBosuPixelArt: React.FC = () => {
  const [discordName, setDiscordName] = useState("");
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [savedArtworks, setSavedArtworks] = useState([]);
  const [statusMessage, setStatusMessage] = useState({ type: "", message: "" });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gridSize, setGridSize] = useState(32);
  const [currentColor, setCurrentColor] = useState(COLORS[0]);
  const [currentTool, setCurrentTool] = useState(TOOLS[0]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pixelData, setPixelData] = useState<string[][]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const canvasSize = 512;
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState("#000000");
  const [history, setHistory] = useState<string[][][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [zoom, setZoom] = useState(1);
  const [gridOpacity, setGridOpacity] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSavedArtworks();
  }, []);

  useEffect(() => {
    initializeGrid();
  }, [gridSize]);

  const fetchSavedArtworks = async () => {
    const { data, error } = await supabase
      .from("pixel_artworks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setStatusMessage({ type: "error", message: error.message });
      return;
    }

    setSavedArtworks(data || []);
  };

  const saveArtwork = async () => {
    if (!discordName) {
      setStatusMessage({
        type: "error",
        message: "Please enter your Discord name to save your artwork",
      });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const imageUrl = canvas.toDataURL();

    const { error } = await supabase.from("pixel_artworks").insert([
      {
        discord_name: discordName,
        image_url: imageUrl,
      },
    ]);

    if (error) {
      setStatusMessage({ type: "error", message: error.message });
      return;
    }

    setStatusMessage({
      type: "success",
      message: "Your pixel art has been added to the gallery",
    });
    fetchSavedArtworks();
  };

  const StatusMessage: React.FC<{ type: string; message: string }> = ({
    type,
    message,
  }) => {
    if (!message) return null;

    const bgColor = type === "error" ? "bg-red-500" : "bg-green-500";

    return (
      <div className={`${bgColor} text-white px-4 py-2 rounded mb-4`}>
        {message}
      </div>
    );
  };

  const initializeGrid = () => {
    const newGrid = Array(gridSize)
      .fill("")
      .map(() => Array(gridSize).fill(isDarkMode ? "#000000" : "#ffffff"));
    setPixelData(newGrid);
    addToHistory(newGrid);
    drawGrid();
  };

  const drawGrid = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cellSize = canvasSize / gridSize;

    ctx.clearRect(0, 0, canvasSize, canvasSize);

    pixelData.forEach((row, y) => {
      row.forEach((color, x) => {
        ctx.fillStyle = color;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      });
    });

    if (gridOpacity > 0) {
      ctx.strokeStyle = isDarkMode
        ? `rgba(51, 51, 51, ${gridOpacity})`
        : `rgba(204, 204, 204, ${gridOpacity})`;
      ctx.lineWidth = 0.5;

      for (let i = 0; i <= gridSize; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, canvasSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(canvasSize, i * cellSize);
        ctx.stroke();
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasSize / rect.width;
    const scaleY = canvasSize / rect.height;
    const x = Math.floor(
      ((e.clientX - rect.left) * scaleX) / (canvasSize / gridSize),
    );
    const y = Math.floor(
      ((e.clientY - rect.top) * scaleY) / (canvasSize / gridSize),
    );

    if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return;

    const newPixelData = [...pixelData];

    if (currentTool === "fill") {
      const targetColor = newPixelData[y][x];
      floodFill(newPixelData, x, y, targetColor, currentColor);
    } else {
      newPixelData[y][x] =
        currentTool === "draw"
          ? currentColor
          : isDarkMode
            ? "#000000"
            : "#ffffff";
    }

    setPixelData(newPixelData);
    addToHistory(newPixelData);
    drawGrid();
  };

  const floodFill = (
    grid: string[][],
    x: number,
    y: number,
    targetColor: string,
    replacementColor: string,
  ) => {
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;
    if (grid[y][x] !== targetColor) return;
    if (targetColor === replacementColor) return;

    grid[y][x] = replacementColor;

    floodFill(grid, x + 1, y, targetColor, replacementColor);
    floodFill(grid, x - 1, y, targetColor, replacementColor);
    floodFill(grid, x, y + 1, targetColor, replacementColor);
    floodFill(grid, x, y - 1, targetColor, replacementColor);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    handleCanvasClick(e);
  };

  const convertToPixelArt = async (imageUrl: string) => {
    setIsLoading(true);
    const canvas = canvasRef.current;

    if (!canvas) {
      setIsLoading(false);
      return;
    }

    try {
      // Define NES-style palette
      const NES_PALETTE: [number, number, number][] = [
        [0, 0, 0], // Black
        [188, 0, 0], // Dark Red
        [255, 51, 51], // Red
        [255, 165, 0], // Orange
        [255, 255, 0], // Yellow
        [51, 255, 51], // Light Green
        [0, 204, 0], // Green
        [0, 204, 204], // Cyan
        [0, 0, 255], // Blue
        [255, 0, 255], // Magenta
        [128, 0, 128], // Purple
        [255, 255, 255], // White
        [192, 192, 192], // Light Gray
        [128, 128, 128], // Mid Gray
      ];

      const img = new window.Image();
      img.src = imageUrl;
      await img.decode();

      // Create a temporary canvas for processing
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx)
        throw new Error("Failed to create temporary canvas context");

      // Set the temp canvas size to match our desired grid size
      tempCanvas.width = gridSize;
      tempCanvas.height = gridSize;

      // Draw the image scaled to our grid size
      tempCtx.drawImage(img, 0, 0, gridSize, gridSize);

      // Get the pixel data from the scaled image
      const imageData = tempCtx.getImageData(0, 0, gridSize, gridSize);

      // Process the image with the 8-bit style
      const processedData = performNESPixelArt(
        imageData,
        1,
        edgeThresh,
        NES_PALETTE,
      ); // gridSize of 1 since we've already scaled

      // Convert processed data to our grid format
      const newPixelData = Array(gridSize)
        .fill(null)
        .map(() => Array(gridSize).fill(""));

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const idx = (y * gridSize + x) * 4;
          const r = processedData.data[idx];
          const g = processedData.data[idx + 1];
          const b = processedData.data[idx + 2];
          newPixelData[y][x] = `rgb(${r},${g},${b})`;
        }
      }

      // Update the pixel data state
      setPixelData(newPixelData);
      addToHistory(newPixelData);
      drawGrid();
    } catch (error) {
      console.error("Error in convertToPixelArt:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const colorDistancePerceptual = (
    c1: [number, number, number],
    c2: [number, number, number],
  ): number => {
    // Convert to LAB color space for better perceptual matching
    const lab1 = rgbToLab(c1);
    const lab2 = rgbToLab(c2);

    // Calculate delta E (color difference)
    const deltaL = lab1[0] - lab2[0];
    const deltaA = lab1[1] - lab2[1];
    const deltaB = lab1[2] - lab2[2];

    return Math.sqrt(
      Math.pow(deltaL, 2) + Math.pow(deltaA, 2) + Math.pow(deltaB, 2),
    );
  };
  const applyDithering = (
    color: [number, number, number],
    targetColor: [number, number, number],
    x: number,
    y: number,
    errors: number[][][],
  ): [number, number, number] => {
    const error = [
      color[0] - targetColor[0],
      color[1] - targetColor[1],
      color[2] - targetColor[2],
    ];

    // Floyd-Steinberg distribution matrix
    const matrix = [
      [null, null, 7 / 16],
      [3 / 16, 5 / 16, 1 / 16],
    ];

    // Distribute error
    for (let i = 0; i < 2; i++) {
      for (let j = -1; j < 2; j++) {
        if (matrix[i][j + 1] === null) continue;
        const factor = matrix[i][j + 1];
        errors[y + i][x + j] = errors[y + i][x + j].map(
          (e, idx) => e + error[idx] * factor,
        );
      }
    }

    return targetColor;
  };
  // Precompute color lookup table for faster matching
  const createColorLookup = (palette: [number, number, number][]) => {
    const lookup = new Map<string, [number, number, number]>();

    // Create a lower resolution lookup table (e.g., 32 levels instead of 256)
    const resolution = 32;
    const step = 256 / resolution;

    for (let r = 0; r < 256; r += step) {
      for (let g = 0; g < 256; g += step) {
        for (let b = 0; b < 256; b += step) {
          const color: [number, number, number] = [r, g, b];
          let closestColor = palette[0];
          let minDistance = colorDistancePerceptual(color, palette[0]);

          for (const pColor of palette) {
            const distance = colorDistancePerceptual(color, pColor);
            if (distance < minDistance) {
              minDistance = distance;
              closestColor = pColor;
            }
          }

          lookup.set(
            `${Math.floor(r / step)},${Math.floor(g / step)},${Math.floor(b / step)}`,
            closestColor,
          );
        }
      }
    }

    return lookup;
  };

  const reduceNoise = (imageData: ImageData): ImageData => {
    const { width, height, data } = imageData;
    const output = new Uint8ClampedArray(data.length);
    const radius = 1;

    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        const idx = (y * width + x) * 4;
        let r = 0,
          g = 0,
          b = 0,
          count = 0;

        // Average with neighbors
        for (let ny = -radius; ny <= radius; ny++) {
          for (let nx = -radius; nx <= radius; nx++) {
            const nidx = ((y + ny) * width + (x + nx)) * 4;
            r += data[nidx];
            g += data[nidx + 1];
            b += data[nidx + 2];
            count++;
          }
        }

        output[idx] = Math.round(r / count);
        output[idx + 1] = Math.round(g / count);
        output[idx + 2] = Math.round(b / count);
        output[idx + 3] = data[idx + 3];
      }
    }

    return new ImageData(output, width, height);
  };
  // Add this before color matching
  const enhanceEdges = (imageData: ImageData): ImageData => {
    const { width, height, data } = imageData;
    const output = new Uint8ClampedArray(data.length);
    const sharpenKernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let r = 0,
          g = 0,
          b = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const kernel = sharpenKernel[(ky + 1) * 3 + (kx + 1)];
            r += data[idx] * kernel;
            g += data[idx + 1] * kernel;
            b += data[idx + 2] * kernel;
          }
        }

        const idx = (y * width + x) * 4;
        output[idx] = Math.min(255, Math.max(0, r));
        output[idx + 1] = Math.min(255, Math.max(0, g));
        output[idx + 2] = Math.min(255, Math.max(0, b));
        output[idx + 3] = data[idx + 3];
      }
    }
    return new ImageData(output, width, height);
  };
  // Modified findClosestPaletteColor using lookup table
  const findClosestPaletteColorFast = (
    color: [number, number, number],
    lookup: Map<string, [number, number, number]>,
    resolution: number = 32,
  ): [number, number, number] => {
    const step = 256 / resolution;
    const key = `${Math.floor(color[0] / step)},${Math.floor(color[1] / step)},${Math.floor(color[2] / step)}`;
    return lookup.get(key) || [0, 0, 0];
  };
  // Helper functions for RGB to LAB conversion
  const rgbToLab = (
    rgb: [number, number, number],
  ): [number, number, number] => {
    // First convert RGB to XYZ
    const xyz = rgbToXyz(rgb);
    // Then convert XYZ to LAB
    return xyzToLab(xyz);
  };

  const rgbToXyz = (
    rgb: [number, number, number],
  ): [number, number, number] => {
    // Convert RGB values to 0-1 range
    let r = rgb[0] / 255;
    let g = rgb[1] / 255;
    let b = rgb[2] / 255;

    // Inverse gamma correction
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    // Convert to XYZ
    const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
    const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const z = r * 0.0193 + g * 0.1192 + b * 0.9505;

    return [x * 100, y * 100, z * 100];
  };

  const xyzToLab = (
    xyz: [number, number, number],
  ): [number, number, number] => {
    // D65 illuminant reference values
    const xn = 95.047;
    const yn = 100.0;
    const zn = 108.883;

    let x = xyz[0] / xn;
    let y = xyz[1] / yn;
    let z = xyz[2] / zn;

    x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
    y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
    z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

    const L = 116 * y - 16;
    const a = 500 * (x - y);
    const b = 200 * (y - z);

    return [L, a, b];
  };
  // Modified performPixelArt with NES-specific optimizations
  const performNESPixelArt = (
    imageData: ImageData,
    gridSize: number,
    edgeThresh: number,
    palette: [number, number, number][],
    options = {
      enableDithering: true,
      enableNoise: true,
      enableEdgeEnhancement: true,
      scanlines: true,
    },
  ): ImageData => {
    let processedData = imageData;

    if (options.enableNoise) {
      processedData = reduceNoise(processedData);
    }

    if (options.enableEdgeEnhancement) {
      processedData = enhanceEdges(processedData);
    }
    const { width, height, data } = imageData;
    const outputData = new Uint8ClampedArray(data.length);

    // Create color lookup table
    const colorLookup = createColorLookup(palette);

    // Pre-process: Increase contrast slightly to make colors more distinct
    const contrastFactor = 1.1;

    for (let y = 0; y < height; y += gridSize) {
      for (let x = 0; x < width; x += gridSize) {
        // Get average color for grid block
        const avgColor = calculateAverageColor(imageData, x, y, gridSize);

        // Apply contrast adjustment
        const contrastedColor: [number, number, number] = [
          Math.min(
            255,
            Math.max(
              0,
              Math.floor(
                ((avgColor[0] / 255 - 0.5) * contrastFactor + 0.5) * 255,
              ),
            ),
          ),
          Math.min(
            255,
            Math.max(
              0,
              Math.floor(
                ((avgColor[1] / 255 - 0.5) * contrastFactor + 0.5) * 255,
              ),
            ),
          ),
          Math.min(
            255,
            Math.max(
              0,
              Math.floor(
                ((avgColor[2] / 255 - 0.5) * contrastFactor + 0.5) * 255,
              ),
            ),
          ),
        ];

        // Find closest NES color using lookup table
        const nesColor = findClosestPaletteColorFast(
          contrastedColor,
          colorLookup,
        );

        // Fill grid block with NES color
        for (
          let blockY = y;
          blockY < Math.min(y + gridSize, height);
          blockY++
        ) {
          for (
            let blockX = x;
            blockX < Math.min(x + gridSize, width);
            blockX++
          ) {
            const idx = (blockY * width + blockX) * 4;
            outputData[idx] = nesColor[0];
            outputData[idx + 1] = nesColor[1];
            outputData[idx + 2] = nesColor[2];
            outputData[idx + 3] = 255;
          }
        }
      }
    }

    // Optional: Add slight scanline effect for more NES feel
    for (let y = 0; y < height; y++) {
      if (y % 2 === 0) continue; // Skip every other line
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        outputData[idx] = Math.floor(outputData[idx] * 0.9);
        outputData[idx + 1] = Math.floor(outputData[idx + 1] * 0.9);
        outputData[idx + 2] = Math.floor(outputData[idx + 2] * 0.9);
      }
    }

    return new ImageData(outputData, width, height);
  };
  const performPixelArt = (
    imageData: ImageData,
    gridSize: number,
    edgeThresh: number,
    palette: [number, number, number][],
  ): ImageData => {
    const { width, height, data } = imageData;
    const outputData = new Uint8ClampedArray(data.length);

    // Step 1: Apply Sobel edge detection
    const edges = sobelEdgeDetection(imageData, edgeThresh);

    // Step 2: Process each pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4;

        // Get current pixel color
        const currentColor: [number, number, number] = [
          data[pixelIndex],
          data[pixelIndex + 1],
          data[pixelIndex + 2],
        ];

        // Find the closest color from the palette
        const closestColor = findClosestPaletteColor(currentColor, palette);

        // Apply edge detection or closest palette color
        if (edges[pixelIndex] === 255) {
          outputData[pixelIndex] = 0;
          outputData[pixelIndex + 1] = 0;
          outputData[pixelIndex + 2] = 0;
          outputData[pixelIndex + 3] = 255;
        } else {
          outputData[pixelIndex] = closestColor[0];
          outputData[pixelIndex + 1] = closestColor[1];
          outputData[pixelIndex + 2] = closestColor[2];
          outputData[pixelIndex + 3] = 255;
        }
      }
    }

    return new ImageData(outputData, width, height);
  };
  // Sobel Edge Detection
  const sobelEdgeDetection = (
    imageData: ImageData,
    threshold: number,
  ): Uint8ClampedArray => {
    const { width, height, data } = imageData;
    const edgeData = new Uint8ClampedArray(data.length);

    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const px = x + kx;
            const py = y + ky;
            const pixelIndex = (py * width + px) * 4;

            const intensity =
              data[pixelIndex] * 0.3 +
              data[pixelIndex + 1] * 0.59 +
              data[pixelIndex + 2] * 0.11;
            gx += intensity * sobelX[(ky + 1) * 3 + (kx + 1)];
            gy += intensity * sobelY[(ky + 1) * 3 + (kx + 1)];
          }
        }

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        const edgeValue = magnitude > threshold ? 255 : 0;

        const pixelIndex = (y * width + x) * 4;
        edgeData[pixelIndex] = edgeValue;
        edgeData[pixelIndex + 1] = edgeValue;
        edgeData[pixelIndex + 2] = edgeValue;
        edgeData[pixelIndex + 3] = 255;
      }
    }

    return edgeData;
  };

  const findClosestPaletteColor = (
    color: [number, number, number],
    palette: [number, number, number][],
  ): [number, number, number] => {
    let closestColor = palette[0];
    let minDistance = Infinity;

    for (const pColor of palette) {
      const distance = colorDistance(color, pColor);
      if (distance < minDistance) {
        minDistance = distance;
        closestColor = pColor;
      }
    }

    return closestColor;
  };

  // Ensure this helper function uses full RGB distance
  const colorDistance = (
    c1: [number, number, number],
    c2: [number, number, number],
  ): number => {
    return Math.sqrt(
      Math.pow(c1[0] - c2[0], 2) +
        Math.pow(c1[1] - c2[1], 2) +
        Math.pow(c1[2] - c2[2], 2),
    );
  };

  const calculateAverageColor = (
    imageData: ImageData,
    startX: number,
    startY: number,
    size: number,
  ): [number, number, number] => {
    const { width, height, data } = imageData;
    let totalR = 0,
      totalG = 0,
      totalB = 0,
      count = 0;

    for (let y = startY; y < startY + size && y < height; y++) {
      for (let x = startX; x < startX + size && x < width; x++) {
        const index = (y * width + x) * 4; // RGBA format
        totalR += data[index]; // Red
        totalG += data[index + 1]; // Green
        totalB += data[index + 2]; // Blue
        count++;
      }
    }

    // Return the average RGB values
    return [
      Math.min(255, Math.max(0, Math.floor(totalR / count))),
      Math.min(255, Math.max(0, Math.floor(totalG / count))),
      Math.min(255, Math.max(0, Math.floor(totalB / count))),
    ];
  };

  const getPixelDataFromImageData = (imageData: ImageData): string[][] => {
    const { width, height, data } = imageData;
    const pixelData: string[][] = [];

    for (let y = 0; y < height; y++) {
      const row: string[] = [];
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        row.push(`rgb(${r},${g},${b})`);
      }
      pixelData.push(row);
    }

    return pixelData;
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = "final-bosu-pixel-art.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      //photoToPixelArt(imageUrl, gridSize, edgeThresh, edgeDilate);

      convertToPixelArt(imageUrl);
    };
    reader.readAsDataURL(file);
  };

  const addToHistory = (newPixelData: string[][]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newPixelData);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setPixelData(history[historyIndex - 1]);
      drawGrid();
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setPixelData(history[historyIndex + 1]);
      drawGrid();
    }
  };

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(e.target.value);
    setZoom(newZoom);
  };

  return (
    <div
      className={`min-h-screen ${isDarkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-black"}`}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-bold">Final Bosu Pixel Art Creator</h1>
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screen%20Shot%202025-01-13%20at%206.41.14%20PM-ER8gD2c2C0fGvn39eevCO4UVXlDrIv.png"
            alt="Final Bosu Logo"
            width={100}
            height={50}
          />
        </div>
        <StatusMessage
          type={statusMessage.type}
          message={statusMessage.message}
        />

        <div className="flex flex-wrap -mx-2 mb-4">
          <div className="w-full md:w-1/2 px-2 mb-4">
            <div className="flex flex-wrap -mx-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  className={`w-8 h-8 m-1 rounded ${
                    color === currentColor ? "ring-2 ring-blue-500" : ""
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setCurrentColor(color)}
                />
              ))}
            </div>
          </div>
          <div className="w-full md:w-1/2 px-2 mb-4">
            <div className="flex flex-wrap -mx-1">
              {TOOLS.map((tool) => (
                <button
                  key={tool}
                  className={`px-3 py-1 m-1 rounded ${
                    tool === currentTool
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-black"
                  }`}
                  onClick={() => setCurrentTool(tool)}
                >
                  {tool}
                </button>
              ))}
            </div>
            <button
              className="px-3 py-1 m-1 rounded bg-gray-200 text-black"
              onClick={() => setShowColorPicker(!showColorPicker)}
            >
              Custom Color
            </button>
            {showColorPicker && (
              <div className="absolute z-10">
                <SketchPicker
                  color={customColor}
                  onChangeComplete={(color) => {
                    setCustomColor(color.hex);
                    setCurrentColor(color.hex);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap -mx-2 mb-4">
          <div className="w-full md:w-1/3 px-2 mb-4">
            <select
              className="w-full p-2 rounded bg-gray-200 text-black"
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value))}
            >
              {GRID_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}x{size}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-1/3 px-2 mb-4">
            <input
              type="file"
              accept="image/*"
              className="w-full p-2 rounded bg-gray-200 text-black"
              onChange={handleFileUpload}
            />
          </div>
          <div className="w-full md:w-1/3 px-2 mb-4">
            <button
              className="w-full p-2 rounded bg-blue-500 text-white"
              onClick={() => setIsDarkMode(!isDarkMode)}
            >
              Toggle Dark Mode
            </button>
          </div>
        </div>

        <div className="flex flex-wrap -mx-2 mb-4">
          <div className="w-full md:w-1/3 px-2 mb-4">
            <button
              className="w-full p-2 rounded bg-blue-500 text-white"
              onClick={undo}
              disabled={historyIndex <= 0}
            >
              Undo
            </button>
          </div>
          <div className="w-full md:w-1/3 px-2 mb-4">
            <button
              className="w-full p-2 rounded bg-blue-500 text-white"
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
            >
              Redo
            </button>
          </div>
          <div className="w-full md:w-1/3 px-2 mb-4">
            <label htmlFor="zoom" className="block mb-2">
              Zoom
            </label>
            <input
              id="zoom"
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={zoom}
              onChange={handleZoomChange}
              className="w-full"
            />
            <span>{zoom.toFixed(1)}x</span>
          </div>
          <div className="w-full md:w-1/3 px-2 mb-4">
            <label htmlFor="gridOpacity" className="block mb-2">
              Grid Opacity
            </label>
            <input
              id="gridOpacity"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={gridOpacity}
              onChange={(e) => setGridOpacity(Number(e.target.value))}
              className="w-full"
            />
            <span>{gridOpacity.toFixed(1)}</span>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              placeholder="Enter your Discord name"
              value={discordName}
              onChange={(e) => setDiscordName(e.target.value)}
              className="flex-1 p-2 rounded border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <button
              onClick={saveArtwork}
              className="px-4 py-2 rounded bg-purple-500 text-white hover:bg-purple-600"
            >
              Save to Gallery
            </button>
            <button
              onClick={() => setIsGalleryOpen(true)}
              className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600"
            >
              View Gallery
            </button>
          </div>
        </div>

        <div className="flex flex-col mb-6">
          <div
            className="mb-6 relative"
            style={{
              width: `${canvasSize}px`,
              height: `${canvasSize}px`,
              overflow: "auto",
            }}
          >
            <div
              ref={containerRef}
              style={{
                width: `${canvasSize * zoom}px`,
                height: `${canvasSize * zoom}px`,
              }}
            >
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
                  <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-white"></div>
                </div>
              )}
              <canvas
                ref={canvasRef}
                width={canvasSize}
                height={canvasSize}
                style={{
                  width: `${canvasSize * zoom}px`,
                  height: `${canvasSize * zoom}px`,
                }}
                className={`border-4 ${isDarkMode ? "border-gray-700" : "border-gray-300"}`}
                onClick={handleCanvasClick}
                onMouseDown={() => setIsDrawing(true)}
                onMouseMove={handleMouseMove}
                onMouseUp={() => setIsDrawing(false)}
                onMouseLeave={() => setIsDrawing(false)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between mb-6">
          <button
            className="px-4 py-2 rounded bg-green-500 text-white"
            onClick={downloadImage}
          >
            Download Pixel Art
          </button>
          <button
            className="px-4 py-2 rounded bg-red-500 text-white"
            onClick={initializeGrid}
          >
            Clear Canvas
          </button>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4">Predefined Final Bosu Art</h2>
          <div className="flex flex-wrap -mx-2">
            {PREDEFINED_ART.map((art) => (
              <div key={art.name} className="w-1/2 md:w-1/5 px-2 mb-4">
                <button
                  className="w-full"
                  onClick={() => {
                    convertToPixelArt(art.url);
                  }}
                >
                  <Image
                    src={art.url}
                    alt={art.name}
                    width={200}
                    height={200}
                    className="w-full h-auto"
                  />
                  <p className="mt-2 text-center">{art.name}</p>
                </button>
              </div>
            ))}
          </div>
        </div>

        <GalleryModal
          isOpen={isGalleryOpen}
          onClose={() => setIsGalleryOpen(false)}
          artworks={savedArtworks}
          onSelect={(artwork) => {
            //photoToPixelArt(artwork.image_url, gridSize, edgeThresh, edgeDilate)
            convertToPixelArt(artwork.image_url);
            setIsGalleryOpen(false);
          }}
        />
      </div>
    </div>
  );
};

export default FinalBosuPixelArt;
