import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, OverlayView } from '@react-google-maps/api';
import { SlidersHorizontal, X, Loader2, MapPin } from 'lucide-react';
import { getMapPinsInBounds } from '@/lib/queries/businesses';
import { StageBadge, ReviewBadge } from '@/components/StatusBadge';
import type { CrmStage, ReviewStatus } from '@/types/acquira';

// ─── Constants ────────────────────────────────────────────────────────────────
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;

// New England center
const NE_CENTER = { lat: 42.15, lng: -71.8 };
const DEFAULT_ZOOM = 9;

// Dark, minimal map style matching app theme
const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry',                      stylers: [{ color: '#0f1629' }] },
  { elementType: 'labels.text.stroke',            stylers: [{ color: '#0f1629' }] },
  { elementType: 'labels.text.fill',              stylers: [{ color: '#3d5a8a' }] },
  { featureType: 'road',        elementType: 'geometry',       stylers: [{ color: '#162040' }] },
  { featureType: 'road',        elementType: 'labels.text.fill', stylers: [{ color: '#2d4a7a' }] },
  { featureType: 'road.highway',elementType: 'geometry',       stylers: [{ color: '#1a2f5c' }] },
  { featureType: 'water',       elementType: 'geometry',       stylers: [{ color: '#080f1e' }] },
  { featureType: 'landscape',   elementType: 'geometry',       stylers: [{ color: '#0d1526' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1d2f5c' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#4a6fa5' }] },
  { featureType: 'administrative.province', elementType: 'labels.text.fill', stylers: [{ color: '#3d5a8a' }] },
  { featureType: 'poi',         stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',     stylers: [{ visibility: 'off' }] },
];

// Pin color by review status
const PIN_COLORS: Record<string, string> = {
  target:     '#22d3a7',
  watch:      '#f59e0b',
  pass:       '#ef4444',
  unreviewed: '#3b82f6',
};

const REVIEW_OPTIONS = [
  { value: '',           label: 'All statuses' },
  { value: 'target',     label: 'Target' },
  { value: 'watch',      label: 'Watch' },
  { value: 'pass',       label: 'Pass' },
  { value: 'unreviewed', label: 'Unreviewed' },
] as const;

const NE_STATES = ['CT', 'MA', 'RI', 'NH', 'VT', 'ME', 'NY', 'NJ'];

type Bounds = { north: number; south: number; east: number; west: number };
type Pin = Awaited<ReturnType<typeof getMapPinsInBounds>>[number];

// ─── Component ────────────────────────────────────────────────────────────────
export default function MapView() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [filterReview, setFilterReview] = useState<ReviewStatus | ''>('');
  const [filterState, setFilterState] = useState<string>('');
  const [pinCount, setPinCount] = useState<number>(0);

  const mapRef = useRef<google.maps.Map | null>(null);
  const idleDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBounds = useRef<Bounds | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY ?? '',
    id: 'google-map-script',
  });

  // ── Fetch pins for the current viewport ──────────────────────────────────
  const fetchPinsForViewport = useCallback(async (map: google.maps.Map) => {
    const b = map.getBounds();
    if (!b) return;

    const bounds: Bounds = {
      north: b.getNorthEast().lat(),
      south: b.getSouthWest().lat(),
      east:  b.getNorthEast().lng(),
      west:  b.getSouthWest().lng(),
    };

    // Skip if bounds haven't meaningfully changed (< 0.01° diff on all sides)
    if (lastBounds.current) {
      const prev = lastBounds.current;
      if (
        Math.abs(bounds.north - prev.north) < 0.01 &&
        Math.abs(bounds.south - prev.south) < 0.01 &&
        Math.abs(bounds.east  - prev.east)  < 0.01 &&
        Math.abs(bounds.west  - prev.west)  < 0.01
      ) return;
    }

    lastBounds.current = bounds;
    setLoading(true);
    setSelectedPin(null);

    try {
      const data = await getMapPinsInBounds(bounds, {
        review_status: filterReview as ReviewStatus || undefined,
        state_abbr:    filterState || undefined,
      }, 500);
      setPins(data);
      setPinCount(data.length);
    } catch (err) {
      console.error('Map pin fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filterReview, filterState]);

  // ── onIdle fires after every pan/zoom completes — debounced 300ms ─────────
  const onIdle = useCallback(() => {
    if (!mapRef.current) return;
    if (idleDebounce.current) clearTimeout(idleDebounce.current);
    idleDebounce.current = setTimeout(() => {
      fetchPinsForViewport(mapRef.current!);
    }, 300);
  }, [fetchPinsForViewport]);

  // Re-fetch when filters change
  useEffect(() => {
    if (mapRef.current) {
      lastBounds.current = null; // force re-fetch
      fetchPinsForViewport(mapRef.current);
    }
  }, [filterReview, filterState, fetchPinsForViewport]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  return (
    <div className="h-screen flex overflow-hidden relative">

      {/* ── Filter Sidebar ─────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="w-[240px] flex-shrink-0 bg-background-secondary border-r border-border flex flex-col z-10">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Filters</span>
            <button onClick={() => setShowFilters(false)} className="text-text-tertiary hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* Viewport stat */}
            <div className="bg-background-tertiary rounded-lg p-3">
              <div className="font-mono text-[11px] text-foreground font-medium">
                {loading ? 'Loading…' : `${pinCount} businesses`}
              </div>
              <div className="font-mono text-[10px] text-text-tertiary mt-0.5">in current view</div>
            </div>

            {/* Review Status */}
            <div>
              <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">Review Status</label>
              <div className="space-y-1">
                {REVIEW_OPTIONS.map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 py-0.5 cursor-pointer">
                    <input
                      type="radio"
                      name="review"
                      checked={filterReview === opt.value}
                      onChange={() => setFilterReview(opt.value as ReviewStatus | '')}
                      className="accent-primary"
                    />
                    <span className="text-sm text-muted-foreground hover:text-foreground transition-colors">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* State quick-filter */}
            <div>
              <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">State</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilterState('')}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${!filterState ? 'bg-primary text-primary-foreground' : 'bg-background-tertiary text-muted-foreground hover:text-foreground'}`}
                >All</button>
                {NE_STATES.map(s => (
                  <button key={s}
                    onClick={() => setFilterState(filterState === s ? '' : s)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${filterState === s ? 'bg-primary text-primary-foreground' : 'bg-background-tertiary text-muted-foreground hover:text-foreground'}`}
                  >{s}</button>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div>
              <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">Legend</label>
              <div className="space-y-1.5">
                {Object.entries(PIN_COLORS).map(([status, color]) => (
                  <div key={status} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: color }} />
                    <span className="font-mono text-[11px] text-muted-foreground capitalize">{status}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Map Area ───────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">

        {/* Top controls */}
        <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
          {!showFilters && (
            <button
              onClick={() => setShowFilters(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card/90 backdrop-blur border border-border text-sm text-muted-foreground hover:text-foreground shadow-lg transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />Filters
            </button>
          )}
        </div>

        {/* Viewport count + loading */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          {loading && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card/90 backdrop-blur border border-border text-xs font-mono text-primary shadow-lg">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading…
            </div>
          )}
          {!loading && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card/90 backdrop-blur border border-border text-xs font-mono text-muted-foreground shadow-lg">
              <MapPin className="w-3 h-3" />
              {pinCount} shown
            </div>
          )}
        </div>

        {/* Google Map */}
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={NE_CENTER}
            zoom={DEFAULT_ZOOM}
            onLoad={onMapLoad}
            onIdle={onIdle}
            onClick={() => setSelectedPin(null)}
            options={{
              styles: MAP_STYLES,
              disableDefaultUI: false,
              zoomControl: true,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
              clickableIcons: false,
            }}
          >
            {pins.map((pin) => {
              if (!pin.lat || !pin.lng) return null;
              const color = PIN_COLORS[pin.review_status as string] ?? PIN_COLORS.unreviewed;
              const isSelected = selectedPin?.id === pin.id;

              return (
                <OverlayView
                  key={pin.id}
                  position={{ lat: pin.lat, lng: pin.lng }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <div
                    onClick={(e) => { e.stopPropagation(); setSelectedPin(pin); }}
                    className="cursor-pointer -translate-x-1/2 -translate-y-1/2"
                    style={{ position: 'absolute' }}
                  >
                    <div
                      style={{
                        width: isSelected ? 14 : 10,
                        height: isSelected ? 14 : 10,
                        borderRadius: '50%',
                        backgroundColor: color,
                        border: isSelected ? `2px solid white` : `1.5px solid rgba(255,255,255,0.3)`,
                        boxShadow: isSelected ? `0 0 0 4px ${color}40, 0 2px 8px rgba(0,0,0,0.5)` : `0 1px 4px rgba(0,0,0,0.4)`,
                        transition: 'all 0.15s ease',
                      }}
                    />
                  </div>
                </OverlayView>
              );
            })}
          </GoogleMap>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-background-tertiary">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {/* ── Selected Pin Info Card (Airbnb-style bottom card) ─────────────── */}
        {selectedPin && (
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[420px] max-w-[90vw]"
            style={{ animation: 'slideUp 0.2s ease' }}
          >
            <div className="bg-card/98 backdrop-blur-md border border-border/80 rounded-2xl p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-foreground truncate">{selectedPin.name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground mt-0.5 truncate">{selectedPin.address}</div>
                </div>
                <button onClick={() => setSelectedPin(null)} className="text-text-tertiary hover:text-foreground transition-colors flex-shrink-0 mt-0.5">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap mt-3">
                <ReviewBadge status={selectedPin.review_status as ReviewStatus} />
                <StageBadge stage={selectedPin.crm_stage as CrmStage} />
                {selectedPin.county && (
                  <span className="font-mono text-[10px] text-text-tertiary bg-background-tertiary px-1.5 py-0.5 rounded">
                    {selectedPin.county}
                  </span>
                )}
              </div>

              {(() => {
                const cls = Array.isArray(selectedPin.classification)
                  ? selectedPin.classification[0]
                  : selectedPin.classification;
                return cls?.business_type ? (
                  <div className="font-mono text-[11px] text-muted-foreground mt-2.5">
                    {cls.business_type}{cls.vertical ? ` · ${cls.vertical}` : ''}
                    {cls.gbp_confidence && (
                      <span className={`ml-2 font-mono text-[10px] ${
                        cls.gbp_confidence === 'High' ? 'text-success' :
                        cls.gbp_confidence === 'Medium' ? 'text-warning' : 'text-text-tertiary'
                      }`}>● {cls.gbp_confidence}</span>
                    )}
                  </div>
                ) : null;
              })()}

              {selectedPin.website && (
                <a
                  href={selectedPin.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-3 font-mono text-[11px] text-primary hover:text-primary/80 transition-colors"
                >
                  Visit website →
                </a>
              )}

              <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                <button className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                  Add to CRM
                </button>
                <button className="flex-1 py-1.5 rounded-lg bg-background-tertiary text-foreground text-xs font-medium hover:bg-background-quaternary transition-colors">
                  Mark as Target
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
