import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Download } from "lucide-react";

interface LightboxImage {
  url: string;
  name: string;
}

interface EvidenceLightboxProps {
  images: LightboxImage[];
  startIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EvidenceLightbox({
  images,
  startIndex,
  open,
  onOpenChange,
}: EvidenceLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  useEffect(() => {
    setCurrentIndex(startIndex);
  }, [startIndex, open]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrevious();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handlePrevious, handleNext, onOpenChange]);

  if (!images.length) return null;

  const currentImage = images[currentIndex];

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = currentImage.url;
    link.download = currentImage.name;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-0">
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-6 w-6" />
        </Button>

        {/* Download button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-16 z-50 text-white hover:bg-white/20"
          onClick={handleDownload}
        >
          <Download className="h-5 w-5" />
        </Button>

        {/* Image counter */}
        <div className="absolute top-4 left-4 z-50 text-white text-sm">
          {currentIndex + 1} / {images.length}
        </div>

        {/* Main image area */}
        <div className="relative flex items-center justify-center w-full h-[90vh]">
          {/* Previous button */}
          {images.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 z-50 text-white hover:bg-white/20 h-12 w-12"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
          )}

          {/* Image */}
          <img
            src={currentImage.url}
            alt={currentImage.name}
            className="max-h-full max-w-full object-contain"
          />

          {/* Next button */}
          {images.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 z-50 text-white hover:bg-white/20 h-12 w-12"
              onClick={handleNext}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          )}
        </div>

        {/* Image name */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm text-center max-w-[80%] truncate">
          {currentImage.name}
        </div>

        {/* Thumbnail strip for multiple images */}
        {images.length > 1 && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-2 max-w-[80%] overflow-x-auto p-2">
            {images.map((img, index) => (
              <button
                key={index}
                className={`flex-shrink-0 h-12 w-12 rounded border-2 overflow-hidden transition-all ${
                  index === currentIndex
                    ? "border-white opacity-100"
                    : "border-transparent opacity-50 hover:opacity-75"
                }`}
                onClick={() => setCurrentIndex(index)}
              >
                <img
                  src={img.url}
                  alt={img.name}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Hook to manage lightbox state
export function useLightbox() {
  const [lightboxState, setLightboxState] = useState<{
    open: boolean;
    images: LightboxImage[];
    startIndex: number;
  }>({
    open: false,
    images: [],
    startIndex: 0,
  });

  useEffect(() => {
    const handleOpenLightbox = (e: CustomEvent) => {
      setLightboxState({
        open: true,
        images: e.detail.images,
        startIndex: e.detail.startIndex,
      });
    };

    window.addEventListener("open-lightbox", handleOpenLightbox as EventListener);
    return () => {
      window.removeEventListener("open-lightbox", handleOpenLightbox as EventListener);
    };
  }, []);

  const closeLightbox = () => {
    setLightboxState((prev) => ({ ...prev, open: false }));
  };

  return {
    ...lightboxState,
    closeLightbox,
    setOpen: (open: boolean) => setLightboxState((prev) => ({ ...prev, open })),
  };
}
