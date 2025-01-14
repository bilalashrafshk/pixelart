"use client";

import React, { useState, useRef, useEffect } from "react";
import { random } from "canvas-sketch-util";
import Image from "next/image";

const GRID_SIZES = [16, 32, 64, 128];
const TOOLS = ["draw", "erase", "fill"];
const COLORS = [
  "#ff3e3e",
  "#ffd700",
  "#1a1b4b",
  "#ffffff",
  "#000000",
  "#4a4a4a",
];

const PREDEFINED_ART = [
  {
    name: "FB Logo",
    url: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screen%20Shot%202025-01-13%20at%206.41.14%20PM-ER8gD2c2C0fGvn39eevCO4UVXlDrIv.png",
  },
  { name: "Character 1", url: "/placeholder.svg?height=200&width=200" },
  { name: "Character 2", url: "/placeholder.svg?height=200&width=200" },
  { name: "Character 3", url: "/placeholder.svg?height=200&width=200" },
  { name: "Character 4", url: "/placeholder.svg?height=200&width=200" },
];

const FinalBosuPixelArt = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gridSize, setGridSize] = useState(32);
  const [currentColor, setCurrentColor] = useState(COLORS[0]);
  const [currentTool, setCurrentTool] = useState(TOOLS[0]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pixelData, setPixelData] = useState<string[][]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    initializeGrid();
  }, [gridSize]);

  const initializeGrid = () => {
    const newGrid = Array(gridSize)
      .fill("")
      .map(() => Array(gridSize).fill(isDarkMode ? "#000000" : "#ffffff"));
    setPixelData(newGrid);
    drawGrid();
  };

  const drawGrid = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cellSize = canvas.width / gridSize;

    pixelData.forEach((row, y) => {
      row.forEach((color, x) => {
        ctx.fillStyle = color;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      });
    });

    // Draw grid lines
    ctx.strokeStyle = isDarkMode ? "#333333" : "#cccccc";
    ctx.lineWidth = 0.5;

    for (let i = 0; i <= gridSize; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvas.width, i * cellSize);
      ctx.stroke();
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (canvas.width / gridSize));
    const y = Math.floor((e.clientY - rect.top) / (canvas.height / gridSize));

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
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new window.Image(); // Using window.Image instead of Image
    img.crossOrigin = "anonymous";

    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const pixelSize = canvas.width / gridSize;
      const newPixelData = Array(gridSize)
        .fill("")
        .map(() => Array(gridSize).fill(""));

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const i =
            (Math.floor(y * pixelSize) * canvas.width +
              Math.floor(x * pixelSize)) *
            4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Apply dithering
          const originalColor = [r, g, b];
          const palette = COLORS.map(hexToRgb);
          const ditheredColor = applyDithering(originalColor, palette, x, y);

          newPixelData[y][x] = rgbToHex(
            ditheredColor[0],
            ditheredColor[1],
            ditheredColor[2],
          );
        }
      }

      setPixelData(newPixelData);
      drawGrid();
    };

    img.src = imageUrl;
  };

  const applyDithering = (
    color: number[],
    palette: number[][],
    x: number,
    y: number,
  ) => {
    const closestColor = findClosestColor(color, palette);
    const error = color.map((c, i) => c - closestColor[i]);

    // Floyd-Steinberg dithering
    distributeError(error, x, y, 7 / 16);
    distributeError(error, x - 1, y + 1, 3 / 16);
    distributeError(error, x, y + 1, 5 / 16);
    distributeError(error, x + 1, y + 1, 1 / 16);

    return closestColor;
  };

  const distributeError = (
    error: number[],
    x: number,
    y: number,
    factor: number,
  ) => {
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;

    const newColor = pixelData[y][x]
      .slice(1)
      .match(/.{2}/g)
      ?.map((hex) => parseInt(hex, 16)) || [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      newColor[i] = Math.max(
        0,
        Math.min(255, Math.round(newColor[i] + error[i] * factor)),
      );
    }
    pixelData[y][x] = rgbToHex(newColor[0], newColor[1], newColor[2]);
  };

  const findClosestColor = (color: number[], palette: number[][]) => {
    return palette.reduce((closest, current) => {
      const currentDiff = color.reduce(
        (sum, c, i) => sum + Math.abs(c - current[i]),
        0,
      );
      const closestDiff = color.reduce(
        (sum, c, i) => sum + Math.abs(c - closest[i]),
        0,
      );
      return currentDiff < closestDiff ? current : closest;
    });
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16),
        ]
      : [0, 0, 0];
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
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
      convertToPixelArt(imageUrl);
    };
    reader.readAsDataURL(file);
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

        <div className="flex flex-wrap -mx-2 mb-4">
          <div className="w-full md:w-1/2 px-2 mb-4">
            <div className="flex flex-wrap -mx-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  className={`w-8 h-8 m-1 rounded ${color === currentColor ? "ring-2 ring-blue-500" : ""}`}
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
                  className={`px-3 py-1 m-1 rounded ${tool === currentTool ? "bg-blue-500 text-white" : "bg-gray-200 text-black"}`}
                  onClick={() => setCurrentTool(tool)}
                >
                  {tool}
                </button>
              ))}
            </div>
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

        <div className="mb-6">
          <canvas
            ref={canvasRef}
            width={512}
            height={512}
            className={`w-full border-4 ${isDarkMode ? "border-gray-700" : "border-gray-300"}`}
            onClick={handleCanvasClick}
            onMouseDown={() => setIsDrawing(true)}
            onMouseMove={handleMouseMove}
            onMouseUp={() => setIsDrawing(false)}
            onMouseLeave={() => setIsDrawing(false)}
          />
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
                  onClick={() => convertToPixelArt(art.url)}
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
      </div>
    </div>
  );
};

export default FinalBosuPixelArt;
