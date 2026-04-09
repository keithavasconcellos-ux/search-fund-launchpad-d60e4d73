import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, useJsApiLoader, OverlayView } from '@react-google-maps/api';
import { SlidersHorizontal, X, Loader2, MapPin, ChevronRight, ChevronDown, RotateCcw } from 'lucide-react';
import { getMapPinsInBounds, getClassificationTaxonomy } from '@/lib/queries/businesses';
import { StageBadge, ReviewBadge } from '@/components/StatusBadge';
import type { CrmStage, ReviewStatus } from '@/types/acquira';

// ─── Constants ────────────────────────────────────────────────────────────────
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const NE_CENTER = { lat: 42.15, lng: -71.8 };
const DEFAULT_ZOOM = 9;

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry',                         stylers: [{ color: '#0f1629' }] },
  { elementType: 'labels.text.stroke',               stylers: [{ color: '#0f1629' }] },
  { elementType: 'labels.text.fill',                 stylers: [{ color: '#3d5a8a' }] },
  { featureType: 'road',        elementType: 'geometry',         stylers: [{ color: '#162040' }] },
  { featureType: 'road',        elementType: 'labels.text.fill', stylers: [{ color: '#2d4a7a' }] },
  { featureType: 'road.highway',elementType: 'geometry',         stylers: [{ color: '#1a2f5c' }] },
  { featureType: 'water',       elementType: 'geometry',         stylers: [{ color: '#080f1e' }] },
  { featureType: 'landscape',   elementType: 'geometry',         stylers: [{ color: '#0d1526' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1d2f5c' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#4a6fa5' }] },
  { featureType: 'administrative.province', elementType: 'labels.text.fill', stylers: [{ color: '#3d5a8a' }] },
  { featureType: 'poi',    stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',stylers: [{ visibility: 'off' }] },
];

const PIN_COLORS: Record<string, string> = {
  target:     '#22d3a7',
  watch:      '#f59e0b',
  pass:       '#ef4444',
  unreviewed: '#3b82f6',
};

const REVIEW_OPTIONS = [
  { value: '',           label: 'All statuses' },
  { value: 'target',     label: '● Target' },
  { value: 'watch',      label: '● Watch' },
  { value: 'pass',       label: '● Pass' },
  { value: 'unreviewed', label: '● Unreviewed' },
] as const;

const NE_STATES = ['CT', 'MA', 'RI', 'NH', 'VT', 'ME', 'NY', 'NJ'];

type Bounds = { north: number; south: number; east: number; west: number };
type Pin = Awaited<ReturnType<typeof getMapPinsInBounds>>[number];

// ─── Drill-Down Filter Section ────────────────────────────────────────────────
interface DrillDownProps {
  taxonomy: Record<string, Record<string, string[]>>
  vertical: string
  category: string
  businessType: string
  onVerticalChange: (v: string) => void
  onCategoryChange: (c: string) => void
  onBusinessTypeChange: (bt: string) => void
}

function DrillDownFilter({
  taxonomy, vertical, category, businessType,
  onVerticalChange, onCategoryChange, onBusinessTypeChange,
}: DrillDownProps) {
  const verticals = Object.keys(taxonomy).sort()
  const categories = vertical ? Object.keys(taxonomy[vertical] ?? {}).sort() : []
  const businessTypes = (vertical && category) ? (taxonomy[vertical]?.[category] ?? []) : []

  const hasAnyFilter = !!(vertical || category || businessType)

  return (
    <div>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">
          Industry Drill-Down
        </label>
        {hasAnyFilter && (
          <button
            onClick={() => { onVerticalChange(''); onCategoryChange(''); onBusinessTypeChange(''); }}
            className="flex items-center gap-1 font-mono text-[10px] text-primary hover:text-primary/80 transition-colors"
          >
            <RotateCcw className="w-2.5 h-2.5" />Reset
          </button>
        )}
      </div>

      {/* L1 — Vertical */}
      <div className="space-y-1 mb-3">
        <div className="font-mono text-[9px] text-text-tertiary uppercase tracking-widest mb-1 flex items-center gap-1">
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-primary/20 text-primary font-bold text-[8px]">1</span>
          Vertical
        </div>
        <div className="flex flex-col gap-0.5">
          {verticals.map(v => (
            <button
              key={v}
              onClick={() => {
                if (vertical === v) { onVerticalChange(''); onCategoryChange(''); onBusinessTypeChange(''); }
                else { onVerticalChange(v); onCategoryChange(''); onBusinessTypeChange(''); }
              }}
              className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-all ${
                vertical === v
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background-tertiary'
              }`}
            >
              <span>{v}</span>
              {vertical === v
                ? <ChevronDown className="w-3 h-3 flex-shrink-0" />
                : <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-40" />
              }
            </button>
          ))}
        </div>
      </div>

      {/* L2 — Category (only when L1 selected) */}
      {vertical && categories.length > 0 && (
        <div className="ml-3 border-l border-border pl-3 mb-3">
          <div className="font-mono text-[9px] text-text-tertiary uppercase tracking-widest mb-1 flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-blue-500/20 text-blue-400 font-bold text-[8px]">2</span>
            Category
          </div>
          <div className="flex flex-col gap-0.5">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => {
                  if (category === c) { onCategoryChange(''); onBusinessTypeChange(''); }
                  else { onCategoryChange(c); onBusinessTypeChange(''); }
                }}
                className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-all ${
                  category === c
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background-tertiary'
                }`}
              >
                <span className="leading-tight">{c}</span>
                {category === c
                  ? <ChevronDown className="w-3 h-3 flex-shrink-0" />
                  : <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-40" />
                }
              </button>
            ))}
          </div>
        </div>
      )}

      {/* L3 — Business Type (only when L2 selected) */}
      {category && businessTypes.length > 0 && (
        <div className="ml-6 border-l border-border pl-3 mb-2">
          <div className="font-mono text-[9px] text-text-tertiary uppercase tracking-widest mb-1 flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-teal-500/20 text-teal-400 font-bold text-[8px]">3</span>
            Business Type
          </div>
          <div className="flex flex-col gap-0.5">
            {businessTypes.map(bt => (
              <button
                key={bt}
                onClick={() => onBusinessTypeChange(businessType === bt ? '' : bt)}
                className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-all ${
                  businessType === bt
                    ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background-tertiary'
                }`}
              >
                {bt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active filter breadcrumb */}
      {hasAnyFilter && (
        <div className="mt-2 px-2 py-1.5 rounded-md bg-background-tertiary border border-border text-[10px] font-mono text-muted-foreground leading-relaxed">
          {[vertical, category, businessType].filter(Boolean).join(' › ')}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MapView() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [filterReview, setFilterReview] = useState<ReviewStatus | ''>('');
  const [filterState, setFilterState] = useState<string>('');
  const [filterVertical, setFilterVertical] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterBusinessType, setFilterBusinessType] = useState<string>('');
  const [pinCount, setPinCount] = useState<number>(0);

  const mapRef = useRef<google.maps.Map | null>(null);
  const idleDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBounds = useRef<Bounds | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY ?? '',
    id: 'google-map-script',
  });

  // Fetch taxonomy once for the drill-down UI
  const { data: taxonomy = {} } = useQuery({
    queryKey: ['classification-taxonomy'],
    queryFn: getClassificationTaxonomy,
    staleTime: 1000 * 60 * 60, // 1 hour cache
  });

  // ── Fetch pins for the current viewport ──────────────────────────────────
  const fetchPinsForViewport = useCallback(async (map: google.maps.Map, force = false) => {
    const b = map.getBounds();
    if (!b) return;

    const bounds: Bounds = {
      north: b.getNorthEast().lat(),
      south: b.getSouthWest().lat(),
      east:  b.getNorthEast().lng(),
      west:  b.getSouthWest().lng(),
    };

    if (!force && lastBounds.current) {
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
        review_status:  filterReview as ReviewStatus || undefined,
        state_abbr:     filterState || undefined,
        vertical:       filterVertical || undefined,
        category:       filterCategory || undefined,
        business_type:  filterBusinessType || undefined,
      }, 500);
      setPins(data);
      setPinCount(data.length);
    } catch (err) {
      console.error('Map pin fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filterReview, filterState, filterVertical, filterCategory, filterBusinessType]);

  const onIdle = useCallback(() => {
    if (!mapRef.current) return;
    if (idleDebounce.current) clearTimeout(idleDebounce.current);
    idleDebounce.current = setTimeout(() => {
      fetchPinsForViewport(mapRef.current!);
    }, 300);
  }, [fetchPinsForViewport]);

  // Re-fetch when any filter changes
  useEffect(() => {
    if (mapRef.current) {
      lastBounds.current = null;
      fetchPinsForViewport(mapRef.current, true);
    }
  }, [filterReview, filterState, filterVertical, filterCategory, filterBusinessType, fetchPinsForViewport]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Count active filters for the badge
  const activeFilterCount = [filterReview, filterState, filterVertical, filterCategory, filterBusinessType].filter(Boolean).length;

  return (
    <div className="h-screen flex overflow-hidden relative">

      {/* ── Filter Sidebar ───────────────────────────────────────────── */}
      {showFilters && (
        <div className="w-[260px] flex-shrink-0 bg-background-secondary border-r border-border flex flex-col z-10">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground font-mono text-[9px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </div>
            <button onClick={() => setShowFilters(false)} className="text-text-tertiary hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* Viewport stat */}
            <div className="bg-background-tertiary rounded-lg p-3">
              <div className="font-mono text-[11px] text-foreground font-medium">
                {loading ? 'Loading…' : `${pinCount.toLocaleString()} businesses`}
              </div>
              <div className="font-mono text-[10px] text-text-tertiary mt-0.5">in current viewport</div>
            </div>

            {/* ── Industry Drill-Down ────────────────────────── */}
            <div className="border-b border-border pb-5">
              <DrillDownFilter
                taxonomy={taxonomy}
                vertical={filterVertical}
                category={filterCategory}
                businessType={filterBusinessType}
                onVerticalChange={setFilterVertical}
                onCategoryChange={setFilterCategory}
                onBusinessTypeChange={setFilterBusinessType}
              />
            </div>

            {/* ── Review Status ──────────────────────────────── */}
            <div className="border-b border-border pb-5">
              <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">Review Status</label>
              <div className="space-y-0.5">
                {REVIEW_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterReview(opt.value as ReviewStatus | '')}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all ${
                      filterReview === opt.value
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background-tertiary'
                    }`}
                  >
                    {opt.value && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIN_COLORS[opt.value] ?? '#888' }} />
                    )}
                    <span>{opt.label.replace('● ', '')}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── State ─────────────────────────────────────── */}
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

            {/* ── Legend ────────────────────────────────────── */}
            <div>
              <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">Legend</label>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-2">
                {Object.entries(PIN_COLORS).map(([status, color]) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full border border-white/20 flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="font-mono text-[10px] text-muted-foreground capitalize">{status}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Map Area ─────────────────────────────────────────────────── */}
      <div className="flex-1 relative">

        {/* Top controls */}
        <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
          {!showFilters && (
            <button
              onClick={() => setShowFilters(true)}
              className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card/90 backdrop-blur border border-border text-sm text-muted-foreground hover:text-foreground shadow-lg transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground font-mono text-[9px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Pin count + loading */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          {loading ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card/90 backdrop-blur border border-border text-xs font-mono text-primary shadow-lg">
              <Loader2 className="w-3 h-3 animate-spin" />Loading…
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card/90 backdrop-blur border border-border text-xs font-mono text-muted-foreground shadow-lg">
              <MapPin className="w-3 h-3" />{pinCount.toLocaleString()} shown
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
                    className="cursor-pointer"
                    style={{ position: 'absolute', transform: 'translate(-50%, -50%)' }}
                  >
                    <div
                      style={{
                        width: isSelected ? 14 : 10,
                        height: isSelected ? 14 : 10,
                        borderRadius: '50%',
                        backgroundColor: color,
                        border: isSelected ? '2px solid white' : '1.5px solid rgba(255,255,255,0.3)',
                        boxShadow: isSelected
                          ? `0 0 0 4px ${color}40, 0 2px 8px rgba(0,0,0,0.5)`
                          : '0 1px 4px rgba(0,0,0,0.4)',
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

        {/* ── Pin info card ──────────────────────────────────────────── */}
        {selectedPin && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[420px] max-w-[90vw]"
               style={{ animation: 'slideUp 0.2s ease' }}>
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
                if (!cls) return null;
                return (
                  <div className="mt-2.5 space-y-0.5">
                    {cls.vertical && (
                      <div className="font-mono text-[10px] text-text-tertiary">
                        {cls.vertical}
                        {cls.category && <span className="text-muted-foreground"> › {cls.category}</span>}
                      </div>
                    )}
                    {cls.business_type && (
                      <div className="font-mono text-[11px] text-foreground">
                        {cls.business_type}
                        {cls.gbp_confidence && (
                          <span className={`ml-2 text-[10px] ${
                            cls.gbp_confidence === 'High'   ? 'text-success' :
                            cls.gbp_confidence === 'Medium' ? 'text-warning' : 'text-text-tertiary'
                          }`}>● {cls.gbp_confidence}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {selectedPin.website && (
                <a href={selectedPin.website} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1 mt-3 font-mono text-[11px] text-primary hover:text-primary/80 transition-colors">
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
