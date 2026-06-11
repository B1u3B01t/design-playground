import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./playground-global.css";
import "./playground-tailwind-entry.css";

export const metadata: Metadata = {
  title: "Playground",
};

/** Runs synchronously in HTML — patches fetch before bundled JS / Liveblocks auth. */
const TUNNEL_FETCH_PATCH = `(function(){if(typeof window==="undefined"||window.__playgroundTunnelFetchPatched)return;var h=location.hostname;if(h==="localhost"||h==="127.0.0.1"||h==="[::1]")return;window.__playgroundTunnelFetchPatched=true;var o=window.fetch.bind(window);function s(u){if(u.charAt(0)==="/")return true;try{return new URL(u,location.origin).origin===location.origin}catch(e){return false}}window.fetch=function(i,n){var u=typeof i==="string"?i:i instanceof Request?i.url:i.href;if(!s(u))return o(i,n);if(i instanceof Request){var rh=new Headers(i.headers);rh.set("ngrok-skip-browser-warning","true");return o(new Request(i,{headers:rh}),n)}var h2=new Headers(n&&n.headers);h2.set("ngrok-skip-browser-warning","true");return o(i,Object.assign({},n,{headers:h2}))}})();`;

export default function PlaygroundLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: TUNNEL_FETCH_PATCH }} />
      {children}
    </>
  );
}
