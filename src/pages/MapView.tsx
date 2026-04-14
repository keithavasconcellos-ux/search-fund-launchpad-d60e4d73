import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, OverlayView } from '@react-google-maps/api';
import { SlidersHorizontal, X, Loader2, MapPin, ChevronRight, ChevronDown, RotateCcw, Search } from 'lucide-react';
import { getMapPinsInBounds } from '@/lib/queries/businesses';
import { CLASSIFICATION_HIERARCHY, getPrimaryGbpCategories } from '@/lib/classificationHierarchy';
import { StageBadge, ReviewBadge } from '@/components/StatusBadge';
import type { CrmStage, ReviewStatus } from '@/types/acquira';

// ─── Constants ────────────────────────────────────────────────────────────────
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const NE_CENTER = { lat: 42.15, lng: -71.8 };
const DEFAULT_ZOOM = 9;

// Must be stable (outside component) to avoid @react-google-maps/api re-load warnings
const LIBRARIES: ('places')[] = ['places'];

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry',                          stylers: [{ color: '#0f1629' }] },
  { elementType: 'labels.text.stroke',                stylers: [{ color: '#0f1629' }] },
  { elementType: 'labels.text.fill',                  stylers: [{ color: '#3d5a8a' }] },
  { featureType: 'road',        elementType: 'geometry',          stylers: [{ color: '#162040' }] },
  { featureType: 'road',        elementType: 'labels.text.fill',  stylers: [{ color: '#2d4a7a' }] },
  { featureType: 'road.highway',elementType: 'geometry',          stylers: [{ color: '#1a2f5c' }] },
  { featureType: 'water',       elementType: 'geometry',          stylers: [{ color: '#080f1e' }] },
  { featureType: 'landscape',   elementType: 'geometry',          stylers: [{ color: '#0d1526' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke',stylers: [{ color: '#1d2f5c' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#4a6fa5' }] },
  { featureType: 'administrative.province', elementType: 'labels.text.fill', stylers: [{ color: '#3d5a8a' }] },
  { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

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

// ─── Level label config ───────────────────────────────────────────────────────
const LEVEL_CONFIG = [
  { label: 'Vertical',           num: '1', color: 'primary',  bg: 'bg-primary/15',     border: 'border-primary/30',     text: 'text-primary'     },
  { label: 'Category',           num: '2', color: 'blue',     bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    text: 'text-blue-400'    },
  { label: 'Business Type',      num: '3', color: 'teal',     bg: 'bg-teal-500/10',    border: 'border-teal-500/20',    text: 'text-teal-400'    },
  { label: 'Primary GBP Cat.',   num: '4', color: 'violet',   bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  text: 'text-violet-400'  },
] as const;

// ─── TownSearch Component ────────────────────────────────────────────────────
interface TownSearchProps {
  mapRef: React.RefObject<google.maps.Map | null>;
}

function TownSearch({ mapRef }: TownSearchProps) {
  const [query, setQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTown, setActiveTown] = useState<string>('');
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Init services once Google Maps SDK is available
  useEffect(() => {
    if (window.google?.maps?.places) {
      serviceRef.current = new google.maps.places.AutocompleteService();
      geocoderRef.current = new google.maps.Geocoder();
    }
  }, []);

  const fetchSuggestions = useCallback((value: string) => {
    if (!serviceRef.current || value.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    serviceRef.current.getPlacePredictions(
      { input: value, types: ['(cities)'], componentRestrictions: { country: 'us' } },
      (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions);
          setIsOpen(true);
        } else {
          setSuggestions([]);
          setIsOpen(false);
        }
      }
    );
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val) { setSuggestions([]); setIsOpen(false); return; }
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 280);
  };

  const handleSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    const mainText = prediction.structured_formatting.main_text;
    const secondText = prediction.structured_formatting.secondary_text ?? '';
    setQuery(mainText);
    setActiveTown(secondText ? `${mainText}, ${secondText}` : mainText);
    setSuggestions([]);
    setIsOpen(false);
    // Geocode by place_id for accuracy, then pan + zoom
    geocoderRef.current?.geocode({ placeId: prediction.place_id }, (results, status) => {
      if (status === 'OK' && results?.[0] && mapRef.current) {
        mapRef.current.panTo(results[0].geometry.location);
        mapRef.current.setZoom(12);
      }
    });
  };

  const handleClear = () => {
    setQuery('');
    setActiveTown('');
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
          onBlur={() => setTimeout(() => setIsOpen(false), 160)}
          placeholder="Search town or city…"
          className="w-full pl-8 pr-7 py-2 rounded-lg bg-background-tertiary border border-border text-xs font-mono text-foreground placeholder:text-text-tertiary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
        />
        {query && (
          <button
            onMouseDown={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg bg-card border border-border shadow-2xl overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              onMouseDown={() => handleSelect(s)}
              className="w-full text-left px-3 py-2 hover:bg-background-tertiary transition-colors border-b border-border/40 last:border-0"
            >
              <span className="text-xs font-mono text-foreground">{s.structured_formatting.main_text}</span>
              {s.structured_formatting.secondary_text && (
                <span className="text-[10px] font-mono text-text-tertiary ml-1.5">
                  {s.structured_formatting.secondary_text}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Active town pill */}
      {activeTown && (
        <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
          <MapPin className="w-2.5 h-2.5 text-primary flex-shrink-0" />
          <span className="font-mono text-[10px] text-primary truncate leading-none">{activeTown}</span>
        </div>
      )}
    </div>
  );
}

// ─── DrillDownFilter Component ────────────────────────────────────────────────
interface DrillDownProps {
  vertical: string; category: string; businessType: string; gbpCategory: string;
  onVertical: (v: string) => void;
  onCategory: (c: string) => void;
  onBusinessType: (bt: string) => void;
  onGbpCategory: (g: string) => void;
}

function DrillItem({
  label, isSelected, onClick, level, hasChildren,
}: {
  label: string; isSelected: boolean; onClick: () => void; level: number; hasChildren?: boolean;
}) {
  const cfg = LEVEL_CONFIG[level];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-all leading-tight ${
        isSelected
          ? `${cfg.bg} ${cfg.text} border ${cfg.border}`
          : 'text-muted-foreground hover:text-foreground hover:bg-background-tertiary'
      }`}
    >
      <span>{label}</span>
      {isSelected
        ? <ChevronDown className="w-3 h-3 flex-shrink-0 ml-1" />
        : hasChildren
        ? <ChevronRight className="w-3 h-3 flex-shrink-0 ml-1 opacity-40" />
        : null
      }
    </button>
  );
}

function DrillDownFilter({ vertical, category, businessType, gbpCategory, onVertical, onCategory, onBusinessType, onGbpCategory }: DrillDownProps) {
  const verticals = Object.keys(CLASSIFICATION_HIERARCHY).sort();
  const categories = vertical ? Object.keys(CLASSIFICATION_HIERARCHY[vertical] ?? {}).sort() : [];
  const businessTypes = (vertical && category) ? Object.keys(CLASSIFICATION_HIERARCHY[vertical]?.[category] ?? {}).sort() : [];
  const gbpCategories = (vertical && category && businessType)
    ? getPrimaryGbpCategories(vertical, category, businessType)
    : [];

  const hasAnyFilter = !!(vertical || category || businessType || gbpCategory);
  const breadcrumb = [vertical, category, businessType, gbpCategory].filter(Boolean).join(' › ');

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Industry Drill-Down</span>
        {hasAnyFilter && (
          <button
            onClick={() => { onVertical(''); onCategory(''); onBusinessType(''); onGbpCategory(''); }}
            className="flex items-center gap-1 font-mono text-[10px] text-primary hover:text-primary/80 transition-colors"
          >
            <RotateCcw className="w-2.5 h-2.5" />Reset
          </button>
        )}
      </div>

      {/* L1 — Vertical */}
      <div className="mb-2">
        <LevelLabel level={0} />
        <div className="flex flex-col gap-0.5 mt-1">
          {verticals.map(v => (
            <DrillItem key={v} label={v} level={0} isSelected={vertical === v} hasChildren
              onClick={() => { if (vertical === v) { onVertical(''); onCategory(''); onBusinessType(''); onGbpCategory(''); } else { onVertical(v); onCategory(''); onBusinessType(''); onGbpCategory(''); } }}
            />
          ))}
        </div>
      </div>

      {/* L2 — Category */}
      {vertical && categories.length > 0 && (
        <div className="ml-3 border-l border-border pl-3 mb-2">
          <LevelLabel level={1} />
          <div className="flex flex-col gap-0.5 mt-1">
            {categories.map(c => (
              <DrillItem key={c} label={c} level={1} isSelected={category === c} hasChildren
                onClick={() => { if (category === c) { onCategory(''); onBusinessType(''); onGbpCategory(''); } else { onCategory(c); onBusinessType(''); onGbpCategory(''); } }}
              />
            ))}
          </div>
        </div>
      )}

      {/* L3 — Business Type */}
      {category && businessTypes.length > 0 && (
        <div className="ml-6 border-l border-border pl-3 mb-2">
          <LevelLabel level={2} />
          <div className="flex flex-col gap-0.5 mt-1">
            {businessTypes.map(bt => (
              <DrillItem key={bt} label={bt} level={2} isSelected={businessType === bt} hasChildren={gbpCategories.length > 0}
                onClick={() => { if (businessType === bt) { onBusinessType(''); onGbpCategory(''); } else { onBusinessType(bt); onGbpCategory(''); } }}
              />
            ))}
          </div>
        </div>
      )}

      {/* L4 — Primary GBP Category */}
      {businessType && gbpCategories.length > 0 && (
        <div className="ml-9 border-l border-border pl-3 mb-2">
          <LevelLabel level={3} />
          <div className="flex flex-col gap-0.5 mt-1">
            {gbpCategories.map(g => (
              <DrillItem key={g} label={g} level={3} isSelected={gbpCategory === g}
                onClick={() => onGbpCategory(gbpCategory === g ? '' : g)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      {hasAnyFilter && (
        <div className="mt-2 px-2 py-1.5 rounded-md bg-background-tertiary border border-border text-[10px] font-mono text-muted-foreground leading-relaxed break-words">
          {breadcrumb}
        </div>
      )}
    </div>
  );
}

function LevelLabel({ level }: { level: number }) {
  const cfg = LEVEL_CONFIG[level];
  return (
    <div className={`flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest ${cfg.text}`}>
      <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded ${cfg.bg} font-bold text-[8px]`}>
        {cfg.num}
      </span>
      {cfg.label}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MapView() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [filterReview, setFilterReview]           = useState<ReviewStatus | ''>('');
  const [filterState, setFilterState]             = useState<string>('');
  const [filterVertical, setFilterVertical]       = useState<string>('');
  const [filterCategory, setFilterCategory]       = useState<string>('');
  const [filterBusinessType, setFilterBusinessType] = useState<string>('');
  const [filterGbpCategory, setFilterGbpCategory] = useState<string>('');
  const [pinCount, setPinCount] = useState<number>(0);

  const mapRef        = useRef<google.maps.Map | null>(null);
  const idleDebounce  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBounds    = useRef<Bounds | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY ?? '',
    id: 'google-map-script',
    libraries: LIBRARIES,
  });

  // ── Fetch pins for current viewport ──────────────────────────────────────
  const fetchPins = useCallback(async (map: google.maps.Map, force = false) => {
    const b = map.getBounds();
    if (!b) return;
    const bounds: Bounds = {
      north: b.getNorthEast().lat(), south: b.getSouthWest().lat(),
      east:  b.getNorthEast().lng(), west:  b.getSouthWest().lng(),
    };
    if (!force && lastBounds.current) {
      const p = lastBounds.current;
      if (Math.abs(bounds.north - p.north) < 0.01 && Math.abs(bounds.south - p.south) < 0.01 &&
          Math.abs(bounds.east  - p.east)  < 0.01 && Math.abs(bounds.west  - p.west)  < 0.01) return;
    }
    lastBounds.current = bounds;
    setLoading(true);
    setSelectedPin(null);
    try {
      const data = await getMapPinsInBounds(bounds, {
        review_status:       filterReview as ReviewStatus || undefined,
        state_abbr:          filterState || undefined,
        vertical:            filterVertical || undefined,
        category:            filterCategory || undefined,
        business_type:       filterBusinessType || undefined,
        primary_gbp_category: filterGbpCategory || undefined,
      }, 500);
      setPins(data);
      setPinCount(data.length);
    } catch (err) {
      console.error('Map pin fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filterReview, filterState, filterVertical, filterCategory, filterBusinessType, filterGbpCategory]);

  const onIdle = useCallback(() => {
    if (!mapRef.current) return;
    if (idleDebounce.current) clearTimeout(idleDebounce.current);
    idleDebounce.current = setTimeout(() => fetchPins(mapRef.current!), 300);
  }, [fetchPins]);

  // Re-fetch on filter change
  useEffect(() => {
    if (mapRef.current) { lastBounds.current = null; fetchPins(mapRef.current, true); }
  }, [filterReview, filterState, filterVertical, filterCategory, filterBusinessType, filterGbpCategory, fetchPins]);

  const onMapLoad = useCallback((map: google.maps.Map) => { mapRef.current = map; }, []);

  const activeFilterCount = [filterReview, filterState, filterVertical, filterCategory, filterBusinessType, filterGbpCategory].filter(Boolean).length;

  return (
    <div className="h-screen flex overflow-hidden relative">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="w-[268px] flex-shrink-0 bg-background-secondary border-r border-border flex flex-col z-10">
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

            {/* ── Town Search ──────────────────────────────────────────────── */}
            <div className="border-b border-border pb-4">
              <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">Location Search</span>
              <TownSearch mapRef={mapRef} />
            </div>

            {/* Viewport stat */}
            <div className="bg-background-tertiary rounded-lg p-3">
              <div className="font-mono text-[11px] text-foreground font-medium">
                {loading ? 'Loading…' : `${pinCount.toLocaleString()} businesses`}
              </div>
              <div className="font-mono text-[10px] text-text-tertiary mt-0.5">in current viewport</div>
            </div>

            {/* ── L1→L4 Industry Drill-Down ───────────────────────────── */}
            <div className="border-b border-border pb-5">
              <DrillDownFilter
                vertical={filterVertical}       category={filterCategory}
                businessType={filterBusinessType} gbpCategory={filterGbpCategory}
                onVertical={setFilterVertical}   onCategory={setFilterCategory}
                onBusinessType={setFilterBusinessType} onGbpCategory={setFilterGbpCategory}
              />
            </div>

            {/* ── Review Status ────────────────────────────────────────── */}
            <div className="border-b border-border pb-5">
              <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">Review Status</span>
              <div className="space-y-0.5">
                {REVIEW_OPTIONS.map(opt => (
                  <button key={opt.value}
                    onClick={() => setFilterReview(opt.value as ReviewStatus | '')}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all ${
                      filterReview === opt.value
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background-tertiary'
                    }`}
                  >
                    {opt.value && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIN_COLORS[opt.value] ?? '#888' }} />}
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── State ────────────────────────────────────────────────── */}
            <div className="border-b border-border pb-5">
              <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">State</span>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setFilterState('')}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${!filterState ? 'bg-primary text-primary-foreground' : 'bg-background-tertiary text-muted-foreground hover:text-foreground'}`}
                >All</button>
                {NE_STATES.map(s => (
                  <button key={s} onClick={() => setFilterState(filterState === s ? '' : s)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${filterState === s ? 'bg-primary text-primary-foreground' : 'bg-background-tertiary text-muted-foreground hover:text-foreground'}`}
                  >{s}</button>
                ))}
              </div>
            </div>

            {/* ── Legend ───────────────────────────────────────────────── */}
            <div>
              <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">Legend</span>
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

      {/* ── Map Area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">

        {/* Toggle filters button */}
        {!showFilters && (
          <div className="absolute top-4 left-4 z-10">
            <button
              onClick={() => setShowFilters(true)}
              className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card/90 backdrop-blur border border-border text-sm text-muted-foreground hover:text-foreground shadow-lg transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground font-mono text-[9px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Pin count / loading */}
        <div className="absolute top-4 right-4 z-10">
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
                <OverlayView key={pin.id} position={{ lat: pin.lat, lng: pin.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                  <div onClick={(e) => { e.stopPropagation(); setSelectedPin(pin); }} className="cursor-pointer"
                       style={{ position: 'absolute', transform: 'translate(-50%, -50%)' }}>
                    <div style={{
                      width: isSelected ? 14 : 10, height: isSelected ? 14 : 10,
                      borderRadius: '50%', backgroundColor: color,
                      border: isSelected ? '2px solid white' : '1.5px solid rgba(255,255,255,0.3)',
                      boxShadow: isSelected ? `0 0 0 4px ${color}40, 0 2px 8px rgba(0,0,0,0.5)` : '0 1px 4px rgba(0,0,0,0.4)',
                      transition: 'all 0.15s ease',
                    }} />
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

        {/* ── Pin info card ──────────────────────────────────────────────── */}
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
                    {/* L1 › L2 › L3 breadcrumb */}
                    {cls.vertical && (
                      <div className="font-mono text-[10px] text-text-tertiary leading-relaxed">
                        {cls.vertical}
                        {cls.category && <span className="text-muted-foreground"> › {cls.category}</span>}
                        {cls.business_type && <span className="text-muted-foreground"> › {cls.business_type}</span>}
                      </div>
                    )}
                    {/* L4 Primary GBP Category */}
                    {cls.primary_gbp_category && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-violet-500/20 text-violet-400 font-bold font-mono text-[8px]">4</span>
                        <span className="font-mono text-[11px] text-violet-400">{cls.primary_gbp_category}</span>
                        {cls.gbp_confidence && (
                          <span className={`ml-1 text-[10px] ${
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
