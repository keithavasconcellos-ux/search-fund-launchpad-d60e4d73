import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CRM_STAGES, CRM_STAGE_LABELS } from '@/types/acquira';
import type { CrmStage } from '@/types/acquira';

interface FormState {
  name: string;
  website: string;
  phone: string;
  primary_email: string;
  address: string;
  state_abbr: string;
  employee_count: string;
  founded_year: string;
  revenue_est_low: string;
  revenue_est_high: string;
  crm_stage: CrmStage;
  notes: string;
}

const EMPTY: FormState = {
  name: '',
  website: '',
  phone: '',
  primary_email: '',
  address: '',
  state_abbr: '',
  employee_count: '',
  founded_year: '',
  revenue_est_low: '',
  revenue_est_high: '',
  crm_stage: 'identified',
  notes: '',
};

function parseIntOrNull(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/[, _]/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseRevenue(s: string): number | null {
  const trimmed = s.trim().toLowerCase();
  if (!trimmed) return null;
  const m = trimmed.match(/^([\d.]+)\s*([km])?$/);
  if (!m) return parseIntOrNull(trimmed);
  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;
  const mult = m[2] === 'k' ? 1_000 : m[2] === 'm' ? 1_000_000 : 1;
  return Math.trunc(base * mult);
}

export default function AddBusinessDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const queryClient = useQueryClient();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: async (f: FormState) => {
      const name = f.name.trim();
      if (!name) throw new Error('Business name is required');

      const insertRow = {
        name,
        website: f.website.trim() || null,
        phone: f.phone.trim() || null,
        primary_email: f.primary_email.trim() || null,
        address: f.address.trim() || null,
        state_abbr: f.state_abbr.trim().toUpperCase() || null,
        employee_count: parseIntOrNull(f.employee_count),
        founded_year: parseIntOrNull(f.founded_year),
        revenue_est_low: parseRevenue(f.revenue_est_low),
        revenue_est_high: parseRevenue(f.revenue_est_high),
        crm_stage: f.crm_stage,
        review_status: 'unreviewed' as const,
        in_crm: true,
        added_via: 'manual',
        last_activity_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('businesses')
        .insert(insertRow)
        .select('id')
        .single();
      if (error) throw error;

      // Optional opening note as an activity row
      const note = f.notes.trim();
      if (note && data?.id) {
        await supabase.from('activities').insert({
          business_id: data.id,
          type: 'note',
          body: note,
        });
      }

      return data;
    },
    onSuccess: () => {
      toast.success('Business added to CRM');
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      setForm(EMPTY);
      setOpen(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to add business';
      toast.error(msg);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Add Deal
        </button>
      </DialogTrigger>
      <DialogContent className="bg-background-secondary border-border max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display italic text-2xl text-foreground">Add a new business</DialogTitle>
          <DialogDescription className="text-text-secondary">
            Manually add a business to your CRM. Only the name is required — fill in whatever you have.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Required */}
          <Field label="Business name *" required>
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Acme Industrial Services"
              autoFocus
              maxLength={200}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Website">
              <Input
                value={form.website}
                onChange={(e) => set('website', e.target.value)}
                placeholder="acme.com"
                maxLength={300}
              />
            </Field>
            <Field label="Primary email">
              <Input
                type="email"
                value={form.primary_email}
                onChange={(e) => set('primary_email', e.target.value)}
                placeholder="owner@acme.com"
                maxLength={255}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="(555) 123-4567"
                maxLength={50}
              />
            </Field>
            <Field label="State">
              <Input
                value={form.state_abbr}
                onChange={(e) => set('state_abbr', e.target.value)}
                placeholder="TX"
                maxLength={2}
              />
            </Field>
          </div>

          <Field label="Address">
            <Input
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="123 Main St, Houston, TX 77002"
              maxLength={300}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Employees">
              <Input
                value={form.employee_count}
                onChange={(e) => set('employee_count', e.target.value)}
                placeholder="25"
                inputMode="numeric"
              />
            </Field>
            <Field label="Founded year">
              <Input
                value={form.founded_year}
                onChange={(e) => set('founded_year', e.target.value)}
                placeholder="1998"
                inputMode="numeric"
                maxLength={4}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Revenue low" hint="e.g. 2M, 500k">
              <Input
                value={form.revenue_est_low}
                onChange={(e) => set('revenue_est_low', e.target.value)}
                placeholder="2M"
              />
            </Field>
            <Field label="Revenue high" hint="e.g. 4M, 750k">
              <Input
                value={form.revenue_est_high}
                onChange={(e) => set('revenue_est_high', e.target.value)}
                placeholder="4M"
              />
            </Field>
          </div>

          <Field label="Starting stage">
            <Select value={form.crm_stage} onValueChange={(v) => set('crm_stage', v as CrmStage)}>
              <SelectTrigger className="bg-background-quaternary border-input rounded-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRM_STAGES.filter((s) => s !== 'passed').map((s) => (
                  <SelectItem key={s} value={s}>{CRM_STAGE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Opening note" hint="Saved as the first activity on this business">
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="How did you find this business? Any context worth keeping…"
              rows={3}
              maxLength={2000}
              className="w-full rounded-[10px] border border-input bg-background-quaternary px-3 py-2 text-sm text-foreground placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal/40 focus-visible:border-teal/60 transition-colors resize-y"
            />
          </Field>

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-[10px] border border-input bg-transparent text-text-secondary text-sm font-medium hover:bg-background-quaternary hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !form.name.trim()}
              className="px-4 py-2 rounded-[10px] bg-teal-secondary border border-teal text-primary-foreground text-sm font-semibold hover:bg-teal hover:shadow-[0_0_20px_hsl(var(--teal)/0.3)] hover:-translate-y-px active:translate-y-0 transition-all disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:cursor-not-allowed"
            >
              {mutation.isPending ? 'Adding…' : 'Add to CRM'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="font-mono text-[9.5px] text-text-secondary uppercase tracking-[1.5px] block">
        {label}
        {required && <span className="text-teal ml-0.5">·</span>}
      </label>
      {children}
      {hint && <div className="font-mono text-[10px] text-text-tertiary">{hint}</div>}
    </div>
  );
}
