"use client";

import Image from "next/image";
import { useState } from "react";

const FALLBACK_THUMBNAIL = "/images/fallback-thumb.svg";

export default function ArticleThumbnail({
  src,
  alt,
  sizes,
  priority = false,
  className = "",
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const activeSrc = !src || failedSrc === src ? FALLBACK_THUMBNAIL : src;

  return (
    <Image
      src={activeSrc}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      referrerPolicy="no-referrer"
      className={`object-cover ${className}`}
      onError={() => {
        if (src && failedSrc !== src) {
          setFailedSrc(src);
        }
      }}
    />
  );
}
