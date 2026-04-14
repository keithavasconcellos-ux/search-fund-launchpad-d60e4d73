import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GoogleMap, useJsApiLoader, OverlayView } from '@react-google-maps/api';
import { SlidersHorizontal, X, Loader2, MapPin, RotateCcw, ChevronDown, Search } from 'lucide-react';
import { getMapPinsInBounds, getClassificationTaxonomy, type TaxonomyTree, type MapPin as MapPinData } from '@/lib/queries/businesses';
import { addToCrm } from '@/lib/queries/crm-actions';
import { supabase } from '@/integrations/supabase/client';
import { StageBadge, ReviewBadge } from '@/components/StatusBadge';
import BusinessRecordPanel from '@/components/BusinessRecordPanel';
import type { CrmStage, ReviewStatus } from '@/types/acquira';

// ─── Constants ────────────────────────────────────────────────────────────────
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const NE_CENTER = { lat: 42.15, lng: -71.8 };
const DEFAULT_ZOOM = 9;

// Must be stable (outside component) to avoid @react-google-maps/api re-load warnings
const LIBRARIES: ('places')[] = ['places'];

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry',                         stylers: [{ color: '#080d1a' }] },
  { elementType: 'labels.text.stroke',               stylers: [{ color: '#080d1a' }] },
  { elementType: 'labels.text.fill',                 stylers: [{ color: '#2a4478' }] },
  { featureType: 'road',        elementType: 'geometry',         stylers: [{ color: '#0e1630' }] },
  { featureType: 'road',        elementType: 'labels.text.fill', stylers: [{ color: '#1e3465' }] },
  { featureType: 'road.highway',elementType: 'geometry',         stylers: [{ color: '#121d40' }] },
  { featureType: 'road.highway',elementType: 'geometry.stroke',  stylers: [{ color: '#1a2a55' }] },
  { featureType: 'water',       elementType: 'geometry',         stylers: [{ color: '#060a14' }] },
  { featureType: 'landscape',   elementType: 'geometry',         stylers: [{ color: '#0a1020' }] },
  { featureType: 'landscape.natural',   elementType: 'geometry', stylers: [{ color: '#0a1020' }] },
  // Bold white state borders
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#ffffff' }, { weight: 2.5 }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#ffffff' }, { weight: 2 }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#3a5a90' }] },
  { featureType: 'administrative.province', elementType: 'labels.text.fill', stylers: [{ color: '#2a4478' }] },
  { featureType: 'administrative.land_parcel', elementType: 'geometry.stroke', stylers: [{ color: '#0e1630' }] },
  { featureType: 'poi',    stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',stylers: [{ visibility: 'off' }] },
];

const PIN_COLORS: Record<string, string> = {
  target:     '#22d3a7',
  watch:      '#f59e0b',
  pass:       '#ef4444',
  unreviewed: '#6b8aff',
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

// ─── TownSearch Component ─────────────────────────────────────────────────────
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

  // Lazy-init services (SDK loads async via useJsApiLoader)
  const ensureServices = useCallback(() => {
    if (!serviceRef.current && window.google?.maps?.places) {
      serviceRef.current = new google.maps.places.AutocompleteService();
      geocoderRef.current = new google.maps.Geocoder();
    }
    return !!serviceRef.current;
  }, []);

  const fetchSuggestions = useCallback((value: string) => {
    if (!ensureServices() || value.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    serviceRef.current!.getPlacePredictions(
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
  }, [ensureServices]);

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

// ─── Cascading Select Component (Tableau-style) ───────────────────────────────
function CascadingSelect({ label, value, options, onChange, disabled, placeholder }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
  disabled?: boolean; placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full appearance-none rounded-md border px-2.5 py-1.5 pr-7 text-xs font-mono transition-colors outline-none cursor-pointer
          ${disabled
            ? 'border-border/40 bg-background-tertiary/30 text-text-tertiary/40 cursor-not-allowed'
            : value
              ? 'border-primary/40 bg-primary/5 text-primary'
              : 'border-border bg-background-tertiary text-muted-foreground hover:border-primary/30 hover:text-foreground'
          }`}
      >
        <option value="">{placeholder ?? `All ${label}s`}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${disabled ? 'text-text-tertiary/30' : 'text-text-tertiary'}`} />
    </div>
  );
}

// ─── Drill-Down Filter Section ────────────────────────────────────────────────
interface DrillDownProps {
  taxonomy: TaxonomyTree
  vertical: string
  category: string
  businessType: string
  subType: string
  onVerticalChange: (v: string) => void
  onCategoryChange: (c: string) => void
  onBusinessTypeChange: (bt: string) => void
  onSubTypeChange: (st: string) => void
}

function DrillDownFilter({
  taxonomy, vertical, category, businessType, subType,
  onVerticalChange, onCategoryChange, onBusinessTypeChange, onSubTypeChange,
}: DrillDownProps) {
  const verticals = Object.keys(taxonomy).sort()
  const categories = vertical ? Object.keys(taxonomy[vertical] ?? {}).sort() : []
  const catData = vertical && category ? taxonomy[vertical]?.[category] : undefined
  const businessTypes = catData ? (Array.isArray(catData) ? catData as string[] : Object.keys(catData).sort()) : []
  const subTypes = (!Array.isArray(catData) && vertical && category && businessType)
    ? (catData?.[businessType] ?? [])
    : []

  const hasAnyFilter = !!(vertical || category || businessType || subType)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">
          Industry
        </label>
        {hasAnyFilter && (
          <button
            onClick={() => { onVerticalChange(''); onCategoryChange(''); onBusinessTypeChange(''); onSubTypeChange(''); }}
            className="flex items-center gap-1 font-mono text-[10px] text-primary hover:text-primary/80 transition-colors"
          >
            <RotateCcw className="w-2.5 h-2.5" />Reset
          </button>
        )}
      </div>

      <div className="space-y-2">
        {/* L1 — Vertical */}
        <CascadingSelect
          label="Vertical"
          value={vertical}
          options={verticals}
          onChange={v => { onVerticalChange(v); onCategoryChange(''); onBusinessTypeChange(''); onSubTypeChange(''); }}
          placeholder="All Verticals"
        />

        {/* L2 — Category */}
        <div className="ml-3 pl-3 border-l border-border/50">
          <CascadingSelect
            label="Category"
            value={category}
            options={categories}
            onChange={c => { onCategoryChange(c); onBusinessTypeChange(''); onSubTypeChange(''); }}
            disabled={!vertical}
            placeholder={vertical ? 'All Categories' : 'Select Vertical first'}
          />
        </div>

        {/* L3 — Business Type */}
        <div className="ml-6 pl-3 border-l border-border/50">
          <CascadingSelect
            label="Business Type"
            value={businessType}
            options={businessTypes}
            onChange={bt => { onBusinessTypeChange(bt); onSubTypeChange(''); }}
            disabled={!category}
            placeholder={category ? 'All Types' : 'Select Category first'}
          />
        </div>

        {/* L4 — Sub-Type (primary_gbp_category) */}
        <div className="ml-9 pl-3 border-l border-border/50">
          <CascadingSelect
            label="Sub-Type"
            value={subType}
            options={subTypes}
            onChange={st => onSubTypeChange(st)}
            disabled={!businessType}
            placeholder={businessType ? 'All Sub-Types' : 'Select Business Type first'}
          />
        </div>
      </div>

      {/* Active filter breadcrumb */}
      {hasAnyFilter && (
        <div className="mt-2 px-2 py-1.5 rounded-md bg-primary/5 border border-primary/20 text-[10px] font-mono text-primary/80 leading-relaxed">
          {[vertical, category, businessType, subType].filter(Boolean).join(' › ')}
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
  const [profileBusinessId, setProfileBusinessId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [filterReview, setFilterReview] = useState<ReviewStatus | ''>('');
  const [filterState, setFilterState] = useState<string>('');
  const [filterCounty, setFilterCounty] = useState<string>('');
  const [filterVertical, setFilterVertical] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterBusinessType, setFilterBusinessType] = useState<string>('');
  const [filterSubType, setFilterSubType] = useState<string>('');
  const [filterInCrm, setFilterInCrm] = useState<'' | 'yes' | 'no'>('');
  const [pinCount, setPinCount] = useState<number>(0);
  const [addedToCrm, setAddedToCrm] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const crmMutation = useMutation({
    mutationFn: (id: string) => addToCrm(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      setAddedToCrm(prev => new Set(prev).add(id));
      // Update the local pin so the popup reflects the change immediately
      setPins(prev => prev.map(p => p.id === id ? { ...p, in_crm: true, crm_stage: 'identified' } : p));
    },
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const idleDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBounds = useRef<Bounds | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY ?? '',
    id: 'google-map-script',
    libraries: LIBRARIES,
  });

  // Fetch taxonomy once for the drill-down UI
  const { data: taxonomy = {} } = useQuery({
    queryKey: ['classification-taxonomy'],
    queryFn: getClassificationTaxonomy,
    staleTime: 1000 * 60 * 60,
  });

  // Fetch distinct counties (optionally filtered by state)
  const { data: counties = [] } = useQuery({
    queryKey: ['distinct-counties', filterState],
    queryFn: async () => {
      let query = supabase
        .from('businesses')
        .select('county')
        .not('county', 'is', null)
        .order('county')
        .limit(5000);
      if (filterState) query = query.eq('state_abbr', filterState);
      const { data, error } = await query;
      if (error) throw error;
      const unique = [...new Set((data ?? []).map(r => r.county).filter(Boolean))] as string[];
      return unique.sort();
    },
    staleTime: 1000 * 60 * 30,
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
        county:         filterCounty || undefined,
        vertical:       filterVertical || undefined,
        category:       filterCategory || undefined,
        business_type:  filterBusinessType || undefined,
        primary_gbp_category: filterSubType || undefined,
        in_crm:         filterInCrm === 'yes' ? true : filterInCrm === 'no' ? false : undefined,
      }, 500);
      setPins(data);
      setPinCount(data.length);
    } catch (err) {
      console.error('Map pin fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filterReview, filterState, filterCounty, filterVertical, filterCategory, filterBusinessType, filterSubType, filterInCrm]);

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
  }, [filterReview, filterState, filterCounty, filterVertical, filterCategory, filterBusinessType, filterSubType, filterInCrm, fetchPinsForViewport]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Count active filters for the badge
  const activeFilterCount = [filterReview, filterState, filterCounty, filterVertical, filterCategory, filterBusinessType, filterInCrm].filter(Boolean).length;

  return (
    <div className="h-screen flex overflow-hidden relative">

      {/* ── Filter Sidebar ──────────────────────────────────────────────── */}
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

            {/* ── Town / City Search ────────────────────────────────────── */}
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

            {/* ── Industry Drill-Down ───────────────────────────────────── */}
            <div className="border-b border-border pb-5">
              <DrillDownFilter
                taxonomy={taxonomy}
                vertical={filterVertical}
                category={filterCategory}
                businessType={filterBusinessType}
                subType={filterSubType}
                onVerticalChange={setFilterVertical}
                onCategoryChange={setFilterCategory}
                onBusinessTypeChange={setFilterBusinessType}
                onSubTypeChange={setFilterSubType}
              />
            </div>

            {/* ── Review Status ─────────────────────────────────────────── */}
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
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── In CRM ───────────────────────────────────────────────── */}
            <div className="border-b border-border pb-5">
              <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">In CRM</label>
              <div className="space-y-0.5">
                {[{ value: '', label: 'All' }, { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterInCrm(opt.value as '' | 'yes' | 'no')}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all ${
                      filterInCrm === opt.value
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background-tertiary'
                    }`}
                  >
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Geography ────────────────────────────────────────────── */}
            <div>
              <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-3">Geography</label>
              
              {/* State */}
              <div className="mb-2">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => { setFilterState(''); setFilterCounty(''); }}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${!filterState ? 'bg-primary text-primary-foreground' : 'bg-background-tertiary text-muted-foreground hover:text-foreground'}`}
                  >All</button>
                  {NE_STATES.map(s => (
                    <button key={s}
                      onClick={() => { setFilterState(filterState === s ? '' : s); setFilterCounty(''); }}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${filterState === s ? 'bg-primary text-primary-foreground' : 'bg-background-tertiary text-muted-foreground hover:text-foreground'}`}
                    >{s}</button>
                  ))}
                </div>
              </div>

              {/* County dropdown */}
              <div className="ml-3 pl-3 border-l border-border/50">
                <CascadingSelect
                  label="County"
                  value={filterCounty}
                  options={counties}
                  onChange={setFilterCounty}
                  disabled={!filterState}
                  placeholder={filterState ? 'All Counties' : 'Select State first'}
                />
              </div>
            </div>

            {/* ── Legend ───────────────────────────────────────────────── */}
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

      {/* ── Map Area ──────────────────────────────────────────────────────── */}
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

        {/* ── Pin info card ─────────────────────────────────────────────── */}
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
                <ReviewStatusDropdown
                  businessId={selectedPin.id}
                  currentStatus={selectedPin.review_status as ReviewStatus}
                  compact
                  onUpdated={(s) => setPins(prev => prev.map(p => p.id === selectedPin.id ? { ...p, review_status: s } : p))}
                />
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
                {(selectedPin.in_crm || addedToCrm.has(selectedPin.id)) ? (
                  <div className="flex-1 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium text-center">
                    ✓ In CRM
                  </div>
                ) : (
                  <button
                    onClick={() => { crmMutation.mutate(selectedPin.id); }}
                    disabled={crmMutation.isPending}
                    className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                  >
                    {crmMutation.isPending ? '…' : 'Add to CRM'}
                  </button>
                )}
                <button
                  onClick={() => { setProfileBusinessId(selectedPin.id); }}
                  className="flex-1 py-1.5 rounded-lg bg-background-tertiary text-foreground text-xs font-medium hover:bg-background-quaternary transition-colors"
                >
                  View Profile
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Business Record Panel */}
      <BusinessRecordPanel
        businessId={profileBusinessId}
        onClose={() => setProfileBusinessId(null)}
      />

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
