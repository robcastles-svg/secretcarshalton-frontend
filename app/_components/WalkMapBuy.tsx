"use client";

import { useState } from "react";
import { PayPalPayButton } from "@/app/advertise/_components/PayPalPayButton";
import type { WalkMap } from "@/lib/walk-maps";

/**
 * "Purchase map" on a walk — stands in for the old WP Express Checkout
 * button. PayPal's script only loads once the reader asks to buy, so
 * walks don't pull it in on every visit. After payment the download
 * button appears straight away, as it did before. The map's thumbnail
 * shows small and blurred as a teaser, and sharpens once it's bought.
 */
export function WalkMapBuy({ map }: { map: WalkMap }) {
  const [buying, setBuying] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  return (
    <div className={`walk-map-buy${map.thumbnail ? " walk-map-buy-has-preview" : ""}`}>
      {map.thumbnail && (
        <div className={`walk-map-buy-preview${downloadUrl ? " walk-map-buy-preview-unlocked" : ""}`} aria-hidden="true">
          <img src={map.thumbnail} alt="" loading="lazy" />
        </div>
      )}
      <div className="walk-map-buy-body">
        <div className="walk-map-buy-head">
          <span className="walk-map-buy-name">{map.name}</span>
          {map.price && <span className="walk-map-buy-price">{map.price}</span>}
        </div>
        {downloadUrl ? (
          <>
            <p className="walk-map-buy-thanks">Thank you — your map is ready.</p>
            <a className="button-pill" href={downloadUrl} target="_blank" rel="noopener" download>
              Download your map
            </a>
          </>
        ) : buying ? (
          <div className="walk-map-buy-paypal">
            <PayPalPayButton
              adId={map.productId}
              endpoints={{
                createOrder: `/api/maps/${map.productId}/create-order`,
                capture: `/api/maps/${map.productId}/capture`,
              }}
              onPaid={(result) => setDownloadUrl(typeof result.downloadUrl === "string" ? result.downloadUrl : null)}
            />
          </div>
        ) : (
          <button type="button" className="button-pill" onClick={() => setBuying(true)}>
            Purchase map
          </button>
        )}
      </div>
    </div>
  );
}
