import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const HOTEL_PIN = L.divIcon({
  className: 'hotel-map-pin',
  html: '<span class="hotel-map-pin-dot"></span>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

export default function HotelMapModal({
  open,
  onClose,
  latitude,
  longitude,
  title = '',
  address = '',
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const hasCoordinates = latitude != null
    && longitude != null
    && Number.isFinite(Number(latitude))
    && Number.isFinite(Number(longitude));
  const mapQuery = [title, address].filter(Boolean).join(', ');
  const googleMapsUrl = mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : '';
  const googleMapsEmbedUrl = mapQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`
    : '';

  useEffect(() => {
    if (!open || !mapRef.current || !hasCoordinates) return undefined;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        center: [latitude, longitude],
        zoom: 15,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;
    map.setView([latitude, longitude], 15);

    if (markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
    } else {
      markerRef.current = L.marker([latitude, longitude], { icon: HOTEL_PIN }).addTo(map);
    }

    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 120);

    return () => {
      window.clearTimeout(resizeTimer);
    };
  }, [hasCoordinates, open, latitude, longitude]);

  useEffect(() => {
    if (open) return undefined;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    }

    return undefined;
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title ? `Map for ${title}` : 'Hotel location map'}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            {title ? <div className="text-sm font-semibold text-slate-900">{title}</div> : null}
            {address ? <div className="text-xs text-slate-500 mt-0.5">{address}</div> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {googleMapsUrl ? (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#2f80ed] hover:bg-slate-50"
              >
                Open in Google Maps
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              aria-label="Close map"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {hasCoordinates ? (
          <div ref={mapRef} className="h-[min(70vh,560px)] w-full" />
        ) : (
          <iframe
            src={googleMapsEmbedUrl}
            title={title ? `Map for ${title}` : 'Hotel location map'}
            className="h-[min(70vh,560px)] w-full border-0"
            loading="eager"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        )}
      </div>
    </div>
  );
}
