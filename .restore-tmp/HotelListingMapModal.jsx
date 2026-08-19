import { useEffect, useMemo, useRef } from 'react';
import { Loader2, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const HOTEL_PIN = L.divIcon({
  className: 'hotel-map-pin',
  html: '<span class="hotel-map-pin-dot"></span>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

const FOCUS_PIN = L.divIcon({
  className: 'hotel-map-pin',
  html: '<span class="hotel-map-pin-dot hotel-map-pin-dot-focused"></span>',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

export default function HotelListingMapModal({
  open,
  onClose,
  title = '',
  subtitle = '',
  hotels = [],
  focusHotelId = '',
  cityCenter = null,
  loading = false,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  const mappableHotels = useMemo(
    () => hotels.filter((hotel) => hotel.latitude != null && hotel.longitude != null),
    [hotels],
  );

  useEffect(() => {
    if (!open || !mapRef.current) return undefined;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        center: [20.5937, 78.9629],
        zoom: 5,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);

      markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    layer.clearLayers();

    const focusId = String(focusHotelId || '');
    mappableHotels.forEach((hotel) => {
      const isFocused = focusId && String(hotel.hotelId || hotel.id) === focusId;
      const marker = L.marker(
        [hotel.latitude, hotel.longitude],
        { icon: isFocused ? FOCUS_PIN : HOTEL_PIN },
      );
      marker.bindPopup(`<strong>${hotel.name}</strong>${hotel.address ? `<div style="margin-top:4px;font-size:12px;">${hotel.address}</div>` : ''}`);
      layer.addLayer(marker);
    });

    const focusedHotel = focusId
      ? mappableHotels.find((hotel) => String(hotel.hotelId || hotel.id) === focusId)
      : null;

    if (focusedHotel) {
      map.setView([focusedHotel.latitude, focusedHotel.longitude], 15);
    } else if (mappableHotels.length > 1) {
      const bounds = L.latLngBounds(mappableHotels.map((hotel) => [hotel.latitude, hotel.longitude]));
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
    } else if (mappableHotels.length === 1) {
      map.setView([mappableHotels[0].latitude, mappableHotels[0].longitude], 14);
    } else if (cityCenter) {
      map.setView([cityCenter.latitude, cityCenter.longitude], 12);
    }

    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(resizeTimer);
  }, [open, mappableHotels, focusHotelId, cityCenter]);

  useEffect(() => {
    if (open) return undefined;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
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
        className="w-full max-w-6xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title ? `Map for ${title}` : 'Hotel listing map'}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            {title ? <div className="text-sm font-semibold text-slate-900">{title}</div> : null}
            {subtitle ? <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Close map"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative">
          <div ref={mapRef} className="h-[min(72vh,620px)] w-full" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow">
                <Loader2 className="h-4 w-4 animate-spin text-accent-500" />
                Loading hotel locations...
              </span>
            </div>
          )}
          {!loading && mappableHotels.length === 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
              <span className="rounded-full bg-white/95 px-4 py-2 text-xs font-medium text-slate-600 shadow">
                Hotel locations are not available for this search yet.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
