import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, useJsApiLoader, OverlayView } from '@react-google-maps/api';
import { SlidersHorizontal, Layers, Target, X } from 'lucide-react';
import { getMapPins } from '@/lib/queries/businesses';
import { StageBadge, ReviewBadge } from '@/components/StatusBadge';
import type { CrmStage, ReviewStatus } from '@/types/acquira';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;

// Map centered on New England
const NE_CENTER = { lat: 42.2, lng: -71.5 };

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0f1629' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f1629' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4a6fa5' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2744' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0f1629' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#3d5a8a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1525' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#111d33' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1d2f5c' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

type Pin = Awaited<ReturnType<typeof getMapPins>>[number];

const PIN_COLORS: Record<ReviewStatus, string> = {
  target:     '#22d3a7',   // teal / success
  watch:      '#f59e0b',   // amber / warning
  pass:       '#ef4444',   // red
  unreviewed: '#3b82f6',   // blue / primary
};

const STATES = ['CT', 'MA', 'RI', 'NH', 'VT', 'ME', 'NY'];
const REVIEW_OPTIONS: { value: ReviewStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'target', label: 'Target' },
  { value: 'watch', label: 'Watch' },
  { value: 'pass', label: 'Pass' },
  { value: 'unreviewed', label: 'Unreviewed' },
];

export default function MapView() {
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [filterState, setFilterState] = useState<string>('');
  const [filterReview, setFilterReview] = useState<ReviewStatus | ''>('');
  const [filterCrm, setFilterCrm] = useState<CrmStage | ''>('');
  const [showFilters, setShowFilters] = useState(true);
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded: mapsLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY ?? '',
    id: 'google-map-script',
  });

  const { data: pins = [], isLoading } = useQuery({
    queryKey: ['map-pins', filterState, filterReview, filterCrm],
    queryFn: () => getMapPins({
      state_abbr:     filterState || undefined,
      review_status:  (filterReview as ReviewStatus) || undefined,
      crm_stage:      (filterCrm as CrmStage) || undefined,
    }),
  });

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const noKey = !GOOGLE_MAPS_KEY;

  // Group pins by ~0.01 degree cells to avoid massive DOM thrash (cluster-lite)
  const visiblePins = pins.slice(0, 3000);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Filter Sidebar */}
      {showFilters && (
        <div className="w-[260px] flex-shrink-0 bg-background-secondary border-r border-border flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Filters</h2>
            <button onClick={() => setShowFilters(false)} className="text-text-tertiary hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Stats */}
            <div className="bg-background-tertiary rounded-lg p-3">
              <div className="font-mono text-[11px] text-text-tertiary mb-1">
                {isLoading ? 'Loading…' : `${pins.length.toLocaleString()} pins loaded`}
              </div>
              <div className="font-mono text-[10px] text-text-tertiary">
                {visiblePins.length.toLocaleString()} shown on map
              </div>
            </div>

            {/* State filter */}
            <div>
              <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">State</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilterState('')}
                  className={`px-2 py-1 rounded text-[11px] font-mono font-medium transition-colors ${!filterState ? 'bg-primary text-primary-foreground' : 'bg-background-tertiary text-muted-foreground hover:text-foreground'}`}
                >All</button>
                {STATES.map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterState(filterState === s ? '' : s)}
                    className={`px-2 py-1 rounded text-[11px] font-mono font-medium transition-colors ${filterState === s ? 'bg-primary text-primary-foreground' : 'bg-background-tertiary text-muted-foreground hover:text-foreground'}`}
                  >{s}</button>
                ))}
              </div>
            </div>

            {/* Review Status */}
            <div>
              <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">Review Status</label>
              <div className="space-y-1">
                {REVIEW_OPTIONS.map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer py-0.5">
                    <input
                      type="radio"
                      name="review_status"
                      checked={filterReview === opt.value}
                      onChange={() => setFilterReview(opt.value as ReviewStatus | '')}
                      className="accent-primary"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div>
              <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">Legend</label>
              <div className="space-y-1.5">
                {(Object.entries(PIN_COLORS) as [ReviewStatus, string][]).map(([status, color]) => (
                  <div key={status} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="font-mono text-[11px] text-muted-foreground capitalize">{status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map Area */}
      <div className="flex-1 relative">
        {/* Top bar */}
        <div className="absolute top-4 left-4 right-4 flex items-center gap-2 z-10">
          {!showFilters && (
            <button
              onClick={() => setShowFilters(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-card/90 backdrop-blur border border-border text-sm text-muted-foreground hover:text-foreground shadow-lg"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div className="px-3 py-2 rounded-md bg-card/90 backdrop-blur border border-border font-mono text-[11px] text-muted-foreground shadow-lg">
              {isLoading ? 'Loading…' : `${pins.length.toLocaleString()} businesses`}
            </div>
          </div>
        </div>

        {/* No key state */}
        {noKey && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background-tertiary z-20">
            <Target className="w-14 h-14 text-text-tertiary mb-4" />
            <h2 className="font-display text-2xl text-foreground italic mb-2">Map View</h2>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
              Add your Google Maps API key to enable the interactive map with {pins.length.toLocaleString()} business pins.
            </p>
            <div className="bg-card border border-border rounded-lg px-4 py-3 font-mono text-xs text-text-tertiary text-center">
              Add <span className="text-primary">VITE_GOOGLE_MAPS_KEY</span> to your .env.local
            </div>
          </div>
        )}

        {/* Google Map */}
        {!noKey && mapsLoaded && (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={NE_CENTER}
            zoom={8}
            onLoad={onMapLoad}
            options={{
              styles: MAP_STYLES,
              disableDefaultUI: false,
              zoomControl: true,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
            }}
            onClick={() => setSelectedPin(null)}
          >
            {visiblePins.map((pin) => {
              if (!pin.lat || !pin.lng) return null;
              const color = PIN_COLORS[pin.review_status as ReviewStatus] ?? PIN_COLORS.unreviewed;
              const isSelected = selectedPin?.id === pin.id;

              return (
                <OverlayView
                  key={pin.id}
                  position={{ lat: pin.lat, lng: pin.lng }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <div
                    onClick={(e) => { e.stopPropagation(); setSelectedPin(pin); }}
                    className="cursor-pointer transition-transform hover:scale-125"
                    style={{ transform: isSelected ? 'scale(1.4)' : 'scale(1)', transition: 'transform 0.15s' }}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full border border-white/30 shadow-lg"
                      style={{
                        backgroundColor: color,
                        boxShadow: isSelected ? `0 0 0 3px ${color}40` : undefined,
                      }}
                    />
                  </div>
                </OverlayView>
              );
            })}
          </GoogleMap>
        )}

        {/* Loading overlay */}
        {!noKey && !mapsLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-background-tertiary">
            <span className="font-mono text-xs text-text-tertiary animate-pulse">Loading map…</span>
          </div>
        )}

        {/* Selected Pin Info Card */}
        {selectedPin && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 w-[380px]">
            <div className="bg-card/95 backdrop-blur border border-border rounded-xl p-4 shadow-2xl">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">{selectedPin.name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground mt-0.5">{selectedPin.address}</div>
                </div>
                <button onClick={() => setSelectedPin(null)} className="text-text-tertiary hover:text-foreground ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                {selectedPin.review_status && (
                  <ReviewBadge status={selectedPin.review_status as ReviewStatus} />
                )}
                {selectedPin.crm_stage && (
                  <StageBadge stage={selectedPin.crm_stage as CrmStage} />
                )}
                {selectedPin.county && (
                  <span className="font-mono text-[10px] text-text-tertiary">{selectedPin.county}</span>
                )}
              </div>
              {(() => {
                const cls = Array.isArray(selectedPin.classification) ? selectedPin.classification[0] : selectedPin.classification;
                return cls?.business_type ? (
                  <div className="font-mono text-[11px] text-muted-foreground mt-2">
                    {cls.business_type}{cls.vertical ? ` · ${cls.vertical}` : ''}
                  </div>
                ) : null;
              })()}
              {selectedPin.website && (
                <a
                  href={selectedPin.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 font-mono text-[10px] text-primary hover:text-primary/80"
                >
                  {selectedPin.website.replace(/^https?:\/\//, '')} →
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
