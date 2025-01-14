    import React from 'react';
    import Image from 'next/image';

    const Artwork = ({ artwork }) => {
      return (
        <div className="bg-white shadow-md rounded-lg p-4">
          <div className="relative h-48">
            <Image 
              src={artwork.image_url} 
              alt={`Artwork by ${artwork.discord_name}`}
              width={200}
              height={200}
              className="w-full h-48 object-cover rounded"
            />
          </div>
          <div className="p-2">
            <h3 className="text-lg font-medium">{artwork.title}</h3>
            <p className="text-gray-600 text-sm">{artwork.description}</p>
            <p className="text-gray-600 text-sm">By: {artwork.discord_name}</p>
          </div>
        </div>
      );
    };

    export default Artwork;

    export const GalleryModal: React.FC<{
      isOpen: boolean;
      onClose: () => void;
      artworks: any[];
      onSelect: (artwork: any) => void;
    }> = ({ isOpen, onClose, artworks, onSelect }) => {
      if (!isOpen) return null;

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold mb-4 dark:text-white">Community Gallery</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {artworks.map((artwork) => (
                <div 
                  key={artwork.id} 
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => onSelect(artwork)}
                >
                  <Image 
                    src={artwork.image_url} 
                    alt={`Artwork by ${artwork.discord_name}`}
                    width={200}
                    height={200}
                    className="w-full h-48 object-cover rounded"
                  />
                  <p className="mt-2 text-sm text-center dark:text-white">{artwork.discord_name}</p>
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                    {new Date(artwork.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    };

