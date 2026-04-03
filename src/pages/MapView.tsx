import { Map as MapIcon, Search, SlidersHorizontal } from 'lucide-react';

export default function MapView() {
  return (
    <div className="h-screen flex">
      {/* Filter Panel */}
      <div className="w-[280px] bg-background-secondary border-r border-border p-5 overflow-y-auto">
        <h2 className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mb-4">Filters</h2>

        <div className="space-y-5">
          {/* Location */}
          <div>
            <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">Location</label>
            <div className="flex items-center gap-2 bg-background-tertiary rounded-md px-3 py-2 text-sm text-foreground">
              <span className="text-primary">◎</span>
              <span>02134 · Allston, MA</span>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-[10px] font-mono text-text-tertiary mb-1">
                <span>Radius</span>
                <span className="text-foreground">50 mi</span>
              </div>
              <div className="w-full bg-background-tertiary rounded-full h-1.5">
                <div className="bg-primary rounded-full h-1.5" style={{ width: '50%' }} />
              </div>
            </div>
          </div>

          {/* NAICS */}
          <div>
            <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">NAICS Sector</label>
            <div className="space-y-1">
              {['Specialty Trade Contractors (238)', 'Administrative Services (561)', 'Repair & Maintenance (811)', 'Health Care Support (621)'].map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer py-1">
                  <input type="checkbox" className="rounded border-border bg-background-tertiary" defaultChecked={s.includes('238') || s.includes('561')} />
                  {s}
                </label>
              ))}
            </div>
          </div>

          {/* Industry */}
          <div>
            <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">Industry</label>
            <div className="space-y-1">
              {['HVAC (238220)', 'Plumbing (238220)', 'Electrical (238210)', 'Roofing (238160)', 'Pest Control (561710)'].map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer py-1">
                  <input type="checkbox" className="rounded border-border bg-background-tertiary" />
                  {s}
                </label>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">Target Status</label>
            <div className="space-y-1">
              {['Target', 'Non-Target', 'Not Yet Reviewed'].map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer py-1">
                  <input type="checkbox" className="rounded border-border bg-background-tertiary" />
                  {s}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 bg-background-tertiary flex items-center justify-center relative">
        <div className="text-center">
          <MapIcon className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
          <h2 className="font-display text-2xl text-foreground italic mb-2">Map View</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Google Maps integration will render here with business pins from the Places API, 
            filterable by NAICS hierarchy and CRM status.
          </p>
          <p className="font-mono text-[10px] text-text-tertiary mt-4 uppercase tracking-wider">
            Requires Google Maps JS + Places API Key
          </p>
        </div>

        {/* Top Controls */}
        <div className="absolute top-4 right-4 flex gap-2">
          <button className="px-3 py-1.5 rounded-md bg-card border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
            ⊕ Satellite
          </button>
          <button className="px-3 py-1.5 rounded-md bg-card border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
            ⊞ Heatmap
          </button>
        </div>
      </div>
    </div>
  );
}
