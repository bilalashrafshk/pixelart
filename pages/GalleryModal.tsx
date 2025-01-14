import React from "react";
import Image from "next/image";

export const GalleryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  artworks: any[];
  onSelect: (artwork: any) => void;
}> = ({ isOpen, onClose, artworks, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="float-right text-2xl">
          &times;
        </button>
        <h2 className="text-2xl font-bold mb-4">Community Gallery</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {artworks.map((artwork) => (
            <div
              key={artwork.id}
              className="cursor-pointer border p-2 rounded"
              onClick={() => onSelect(artwork)}
            >
              {artwork?.image_url && (
                <Image
                  src={artwork.image_url}
                  alt={artwork.title || "Artwork"}
                  width={200}
                  height={200}
                  className="w-full h-40 object-cover mb-2"
                />
              )}
              <p className="font-semibold">
                {artwork?.discord_name ?? "Unknown Artist"}
              </p>
              <p className="text-sm text-gray-500">
                {artwork?.created_at
                  ? new Date(artwork.created_at).toLocaleDateString()
                  : "Date unknown"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
