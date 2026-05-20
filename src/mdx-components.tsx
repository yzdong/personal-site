import type { MDXComponents } from "mdx/types";
import type { ImgHTMLAttributes } from "react";

const WIDE_IMAGES = new Set([
  "roles.png",
  "run-timeline.png",
  "run-interactions.png",
]);

function MdxImg({ src, alt, ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const filename = typeof src === "string" ? (src.split("/").pop() ?? "") : "";
  const isWide = WIDE_IMAGES.has(filename);
  return (
    <img
      src={src}
      alt={alt}
      className={isWide ? "wide-figure" : undefined}
      {...rest}
    />
  );
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...components, img: MdxImg };
}
