import { useEffect } from "react";

const SITE_ORIGIN = "https://mtggen.igottic.com";
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/logo.png`;
const DEFAULT_TITLE = "MagicGen | MTG tools and generators";
const DEFAULT_DESCRIPTION =
  "MagicGen is a suite of Magic: The Gathering tools: random commanders, pods, proxies, boosters, supplies, and more.";

export type SeoProps = {
  title: string;
  description: string;
  path?: string;
  image?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

function upsertJsonLd(id: string, data: Record<string, unknown> | Record<string, unknown>[]) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

/** Per-route document title, description, Open Graph, Twitter, and canonical. */
export function Seo({ title, description, path = "/", image = DEFAULT_OG_IMAGE, jsonLd }: SeoProps) {
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : "";

  useEffect(() => {
    const fullTitle = title.includes("MagicGen") ? title : `${title} | MagicGen`;
    // Canonical must stay on our origin — reject protocol-relative / external paths
    const safePath =
      path.startsWith("/") && !path.startsWith("//") && !path.includes("://")
        ? path
        : "/";
    const canonical = `${SITE_ORIGIN}${safePath === "/" ? "/" : safePath}`;
    const safeImage =
      image.startsWith(SITE_ORIGIN + "/") || image.startsWith("/")
        ? image.startsWith("/")
          ? `${SITE_ORIGIN}${image}`
          : image
        : DEFAULT_OG_IMAGE;

    document.title = fullTitle;
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", "MagicGen");
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:image", safeImage);
    upsertMeta("name", "twitter:card", "summary");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", safeImage);
    upsertLink("canonical", canonical);

    if (jsonLd) {
      upsertJsonLd("magicgen-jsonld", jsonLd);
    } else {
      document.getElementById("magicgen-jsonld")?.remove();
    }

    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title, description, path, image, jsonLd, jsonLdKey]);

  return null;
}

export { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SITE_ORIGIN };
