// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SECTION_KEYS = [
  "business_overview",
  "financial_profile",
  "management_team",
  "customer_analysis",
  "operations",
  "market_position",
] as const;

const emptySection = () => ({
  summary: null,
  flags: [],
  criteria: [],
  not_disclosed: [],
});

const emptyMemoSections = () => ({
  business_overview: emptySection(),
  financial_profile: emptySection(),
  management_team: emptySection(),
  customer_analysis: emptySection(),
  operations: emptySection(),
  market_position: emptySection(),
  deal_breaker_check: {
    fired: false,
    conditions_evaluated: 6,
    flags: [],
    not_disclosed: [],
  },
  anacapa_fit_scorecard: {
    quadrant_1: null,
    quadrant_2: null,
    quadrant_3: null,
    quadrant_4: null,
    descriptors: { quadrant_1: "", quadrant_2: "", quadrant_3: "", quadrant_4: "" },
  },
  // Section 7 + 8 extras
  risk_register: [] as Array<{
    label: string;
    severity: "high" | "medium" | "low";
    description: string;
    mitigant: string;
  }>,
  investment_thesis: {
    thesis: "",
    bull_case: [] as string[],
    bear_case: [] as string[],
    next_steps: [] as string[],
  },
});

const SYSTEM_PROMPT = `You are a senior search-fund acquisition analyst writing a structured Due Diligence memo on a small business acquisition target.

You will receive: (1) the business name and metadata, (2) optional source material (CIM excerpt or call notes), (3) optional additional context from the analyst.

Your job is to extract evidence-grounded facts into a strict JSON schema covering 8 memo sections plus an Anacapa fit scorecard, risk register, and investment thesis. NEVER invent facts. If something is not present in the source material, list the field name in 'not_disclosed' for that section, and set its 'criteria' status to 'not_disclosed'.

Be concise. Each summary is 2-4 sentences of muted, factual prose. Each criterion 'value' is a short phrase, not a paragraph.

Status colours:
- green = clear strength, no concerns
- yellow = adequate but with caveats / needs verification
- red = material concern
- not_disclosed = source material is silent

Anacapa scorecard quadrant ratings (green/yellow/red, or null if insufficient data):
- quadrant_1 Business Quality (model clarity, market position, tech stability)
- quadrant_2 Financial Profile (cash flow quality, revenue mix, EBITDA margin)
- quadrant_3 Management (owner dependency, key employee depth, succession)
- quadrant_4 Deal Structure (valuation, terms, financing fit)
For each quadrant also write a one-sentence descriptor.

Deal breaker fires (set deal_breaker_check.fired = true and add a flag) ONLY when one of these is clearly present:
- Owner is sole licensed technician with no other licensed staff AND transition timeline < 6 months
- Single customer > 30% of revenue
- Revenue declining > 15% year-over-year for 2 consecutive years
- Material undisclosed litigation
- Asking price implies < 2.5x or > 7x SDE
- EBITDA margin negative

Risk register: produce 3-6 risks sorted High → Low, each with one-sentence description and one-sentence mitigant.

Investment thesis: 3-4 sentence paragraph, exactly 3 bull bullets, exactly 3 bear bullets, 3-5 next steps.

Confidence level (low/medium/high) self-assesses how complete the source material was.`;

const memoToolSchema = {
  type: "object",
  properties: {
    sections: {
      type: "object",
      properties: {
        business_overview: sectionSchema(),
        financial_profile: sectionSchema(),
        management_team: sectionSchema(),
        customer_analysis: sectionSchema(),
        operations: sectionSchema(),
        market_position: sectionSchema(),
        deal_breaker_check: {
          type: "object",
          properties: {
            fired: { type: "boolean" },
            conditions_evaluated: { type: "number" },
            flags: { type: "array", items: { type: "string" } },
            not_disclosed: { type: "array", items: { type: "string" } },
          },
          required: ["fired", "conditions_evaluated", "flags", "not_disclosed"],
        },
        anacapa_fit_scorecard: {
          type: "object",
          properties: {
            quadrant_1: { type: "string", enum: ["green", "yellow", "red", "null"] },
            quadrant_2: { type: "string", enum: ["green", "yellow", "red", "null"] },
            quadrant_3: { type: "string", enum: ["green", "yellow", "red", "null"] },
            quadrant_4: { type: "string", enum: ["green", "yellow", "red", "null"] },
            descriptors: {
              type: "object",
              properties: {
                quadrant_1: { type: "string" },
                quadrant_2: { type: "string" },
                quadrant_3: { type: "string" },
                quadrant_4: { type: "string" },
              },
              required: ["quadrant_1", "quadrant_2", "quadrant_3", "quadrant_4"],
            },
          },
          required: ["quadrant_1", "quadrant_2", "quadrant_3", "quadrant_4", "descriptors"],
        },
        risk_register: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              severity: { type: "string", enum: ["high", "medium", "low"] },
              description: { type: "string" },
              mitigant: { type: "string" },
            },
            required: ["label", "severity", "description", "mitigant"],
          },
        },
        investment_thesis: {
          type: "object",
          properties: {
            thesis: { type: "string" },
            bull_case: { type: "array", items: { type: "string" } },
            bear_case: { type: "array", items: { type: "string" } },
            next_steps: { type: "array", items: { type: "string" } },
          },
          required: ["thesis", "bull_case", "bear_case", "next_steps"],
        },
      },
      required: [
        "business_overview",
        "financial_profile",
        "management_team",
        "customer_analysis",
        "operations",
        "market_position",
        "deal_breaker_check",
        "anacapa_fit_scorecard",
        "risk_register",
        "investment_thesis",
      ],
    },
    investment_thesis_paragraph: { type: "string" },
    open_questions: { type: "array", items: { type: "string" } },
    suggested_next_step: { type: "string" },
    risk_flags: { type: "array", items: { type: "string" } },
    confidence_level: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["sections", "investment_thesis_paragraph", "open_questions", "risk_flags", "confidence_level"],
};

function sectionSchema() {
  return {
    type: "object",
    properties: {
      summary: { type: "string" },
      flags: { type: "array", items: { type: "string" } },
      criteria: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "string" },
            status: { type: "string", enum: ["green", "yellow", "red", "not_disclosed"] },
          },
          required: ["label", "value", "status"],
        },
      },
      not_disclosed: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "flags", "criteria", "not_disclosed"],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      business_id,
      input_type, // 'cim' | 'call_notes' | 'name_only'
      input_text, // CIM extracted text OR call notes OR ''
      analysis_label,
      additional_context,
      page_count,
    } = body ?? {};

    if (!business_id || !input_type) {
      return json({ error: "business_id and input_type are required" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Pull business + classification for AI context
    const { data: biz, error: bizErr } = await admin
      .from("businesses")
      .select("id, name, address, city, state, website, rating, review_count, employee_count, founded_year, revenue_est_low, revenue_est_high")
      .eq("id", business_id)
      .single();
    if (bizErr || !biz) return json({ error: "business not found" }, 404);

    const { data: cls } = await admin
      .from("business_classifications")
      .select("vertical, category, business_type, services_offered, business_description, industry_keywords")
      .eq("business_id", business_id)
      .maybeSingle();

    // Build user prompt
    const userPrompt = buildUserPrompt({
      biz,
      classification: cls,
      input_type,
      input_text,
      additional_context,
    });

    let extracted: any = null;

    if (input_type !== "name_only") {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "emit_dd_memo",
                description: "Emit the structured DD memo extraction.",
                parameters: memoToolSchema,
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "emit_dd_memo" } },
        }),
      });

      if (!aiResp.ok) {
        const errText = await aiResp.text();
        console.error("AI gateway error", aiResp.status, errText);
        if (aiResp.status === 429) return json({ error: "Rate limit exceeded. Please retry." }, 429);
        if (aiResp.status === 402) return json({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }, 402);
        return json({ error: "AI gateway error" }, 500);
      }
      const aiJson = await aiResp.json();
      const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        console.error("No tool call in response", JSON.stringify(aiJson).slice(0, 500));
        return json({ error: "AI returned no structured output" }, 500);
      }
      try {
        extracted = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Bad tool args", e);
        return json({ error: "AI returned malformed JSON" }, 500);
      }
    }

    // Build sections payload (name-only = empty skeleton)
    const sections = extracted?.sections ?? emptyMemoSections();

    // Normalize "null" string to actual null in scorecard quadrants
    if (sections.anacapa_fit_scorecard) {
      for (const q of ["quadrant_1", "quadrant_2", "quadrant_3", "quadrant_4"]) {
        if (sections.anacapa_fit_scorecard[q] === "null") sections.anacapa_fit_scorecard[q] = null;
      }
    }

    // Determine version (count existing memos for this business + 1)
    const { count } = await admin
      .from("dd_memos")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business_id);
    const version = (count ?? 0) + 1;

    const insertRow = {
      business_id,
      version,
      model_used: input_type === "name_only" ? "skeleton" : "google/gemini-2.5-pro",
      sections,
      risk_flags: extracted?.risk_flags ?? [],
      deal_breaker_fired: !!sections?.deal_breaker_check?.fired,
      investment_thesis: extracted?.investment_thesis_paragraph ?? null,
      open_questions: extracted?.open_questions ?? [],
      suggested_next_step: extracted?.suggested_next_step ?? null,
      analysis_label: analysis_label ?? "Initial DD",
      input_type,
      input_page_count: page_count ?? null,
      confidence_level: extracted?.confidence_level ?? (input_type === "name_only" ? "low" : null),
      additional_context: additional_context ?? null,
    };

    const { data: memo, error: insertErr } = await admin
      .from("dd_memos")
      .insert(insertRow)
      .select()
      .single();

    if (insertErr) {
      console.error("insert memo error", insertErr);
      return json({ error: insertErr.message }, 500);
    }

    return json({ memo }, 200);
  } catch (e: any) {
    console.error("generate-dd-memo error", e);
    return json({ error: e?.message ?? "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildUserPrompt(args: {
  biz: any;
  classification: any;
  input_type: string;
  input_text?: string;
  additional_context?: string;
}) {
  const { biz, classification, input_type, input_text, additional_context } = args;
  const lines: string[] = [];
  lines.push(`# Business`);
  lines.push(`Name: ${biz.name}`);
  if (biz.address) lines.push(`Address: ${biz.address}`);
  if (classification?.vertical) lines.push(`Vertical: ${classification.vertical}`);
  if (classification?.category) lines.push(`Category: ${classification.category}`);
  if (classification?.business_type) lines.push(`Business type: ${classification.business_type}`);
  if (classification?.business_description) lines.push(`Description: ${classification.business_description}`);
  if (classification?.services_offered) lines.push(`Services: ${classification.services_offered}`);
  if (biz.website) lines.push(`Website: ${biz.website}`);
  if (biz.rating) lines.push(`Google rating: ${biz.rating} (${biz.review_count ?? 0} reviews)`);
  if (biz.employee_count) lines.push(`Estimated employees: ${biz.employee_count}`);
  if (biz.founded_year) lines.push(`Founded: ${biz.founded_year}`);
  if (biz.revenue_est_low || biz.revenue_est_high)
    lines.push(`Revenue estimate range: $${biz.revenue_est_low ?? "?"} – $${biz.revenue_est_high ?? "?"}`);

  lines.push(``);
  lines.push(`# Input mode: ${input_type}`);

  if (input_type === "cim" && input_text) {
    lines.push(``);
    lines.push(`# CIM document content (truncated to first 60k chars)`);
    lines.push(input_text.slice(0, 60000));
  } else if (input_type === "call_notes" && input_text) {
    lines.push(``);
    lines.push(`# Owner call notes`);
    lines.push(input_text);
  }

  if (additional_context) {
    lines.push(``);
    lines.push(`# Additional analyst context`);
    lines.push(additional_context);
  }

  lines.push(``);
  lines.push(`Produce the structured memo. Use the emit_dd_memo tool.`);
  return lines.join("\n");
}
