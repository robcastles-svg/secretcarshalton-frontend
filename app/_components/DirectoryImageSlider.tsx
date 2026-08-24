"use client";

import { useState } from "react";

interface SlideImage {
  url: string;
  alt: string;
}

/** Featured image + gallery photos as one slider at the top of a directory listing — a single photo just renders plain, no slider chrome for nothing to slide between. */
export function DirectoryImageSlider({ images }: { images: SlideImage[] }) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <div className="directory-image-slider directory-image-slider-single">
        <img src={images[0].url} alt={images[0].alt} />
      </div>
    );
  }

  const go = (delta: number) => setIndex((i) => (i + delta + images.length) % images.length);

  return (
    <div className="directory-image-slider">
      <div className="directory-image-slider-viewport">
        <img src={images[index].url} alt={images[index].alt} />
      </div>
      <button
        type="button"
        className="directory-image-slider-arrow directory-image-slider-prev"
        onClick={() => go(-1)}
        aria-label="Previous photo"
      >
        ‹
      </button>
      <button
        type="button"
        className="directory-image-slider-arrow directory-image-slider-next"
        onClick={() => go(1)}
        aria-label="Next photo"
      >
        ›
      </button>
      <div className="directory-image-slider-dots">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            className={i === index ? "active" : undefined}
            onClick={() => setIndex(i)}
            aria-label={`Go to photo ${i + 1} of ${images.length}`}
          />
        ))}
      </div>
      <span className="directory-image-slider-count">
        {index + 1} / {images.length}
      </span>
    </div>
  );
}
