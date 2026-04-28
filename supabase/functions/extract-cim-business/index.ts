// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are an analyst reading a Confidential Information Memorandum (CIM) for a small-business acquisition.

You will be given (1) the business name the user provided, and (2) the CIM document. Read the CIM carefully and extract structured facts. NEVER invent values — if a field is not present, return null (or an empty string for description fields). Be conservative and factual.

Also produce a clean plain-text dump of the CIM's substantive content (skip cover pages, legal disclaimers, table of contents, page numbers). This dump is used to generate the downstream DD memo. Aim for 8,000–40,000 characters of clean text. Preserve numbers, headings, and bullet structure.`;

// Tool schema mirrors the fields we want to populate on the businesses + business_classifications tables.
const extractToolSchema = {
  type: "object",
  properties: {
    business: {
      type: "object",
      properties: {
        name: { type: "string", description: "Confirmed legal/operating name (use user-provided if CIM is unclear)." },
        address: { type: "string" },
        city: { type: "string" },
        state: { type: "string", description: "Full state name." },
        state_abbr: { type: "string", description: "Two-letter state code." },
        county: { type: "string" },
        country: { type: "string" },
        website: { type: "string" },
        phone: { type: "string" },
        primary_email: { type: "string" },
        founded_year: { type: "number" },
        employee_count: { type: "number" },
        revenue_est_low: { type: "number", description: "Annual revenue low estimate in USD (no commas)." },
        revenue_est_high: { type: "number", description: "Annual revenue high estimate in USD (no commas)." },
        revenue_verified_value: { type: "number", description: "Most recent stated annual revenue if disclosed." },
        ebitda_margin_verified: { type: "number", description: "EBITDA margin as decimal (e.g. 0.18 for 18%)." },
        revenue_confidence: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["name"],
    },
    classification: {
      type: "object",
      properties: {
        vertical: { type: "string" },
        category: { type: "string" },
        business_type: { type: "string" },
        business_description: { type: "string", description: "1-3 sentence description of what the business does." },
        services_offered: { type: "string" },
        industry_keywords: { type: "string" },
        customer_type: { type: "string", enum: ["B2B", "B2C", "B2G", "Mixed"] },
        geographic_scope: { type: "string", enum: ["Local", "Regional", "National", "International"] },
        years_in_business: { type: "string" },
      },
    },
    cim_text_dump: {
      type: "string",
      description: "Clean plain-text extraction of the substantive CIM content for downstream memo analysis.",
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["business", "cim_text_dump", "confidence"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { name, file_base64, file_mime, file_name } = body ?? {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return json({ error: "name is required" }, 400);
    }
    if (!file_base64 || !file_mime) {
      return json({ error: "file_base64 and file_mime are required" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Multimodal call: pass the file as a data URL inside a user content part.
    // Lovable AI Gateway / Gemini accepts OpenAI-style image_url with a base64 data URL,
    // and supports application/pdf for Gemini 2.5 / 3 models.
    const dataUrl = `data:${file_mime};base64,${file_base64}`;

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
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `User-provided business name: "${name}"\nFilename: ${file_name ?? "(unknown)"}\n\nRead the attached CIM and extract the structured fields. Use the extract_cim_business tool.`,
              },
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_cim_business",
              description: "Extract structured business facts and a clean text dump from the CIM.",
              parameters: extractToolSchema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_cim_business" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error", aiResp.status, errText);
      if (aiResp.status === 429) return json({ error: "Rate limit exceeded. Please retry." }, 429);
      if (aiResp.status === 402) {
        return json({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }, 402);
      }
      return json({ error: `AI gateway error: ${errText.slice(0, 300)}` }, 500);
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call in response", JSON.stringify(aiJson).slice(0, 800));
      return json({ error: "AI returned no structured output" }, 500);
    }

    let extracted: any;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Bad tool args", e);
      return json({ error: "AI returned malformed JSON" }, 500);
    }

    const b = extracted.business ?? {};
    const c = extracted.classification ?? {};

    // Compose business insert. Trust user-provided name over AI guess.
    const bizInsert: Record<string, any> = {
      name: name.trim(),
      address: b.address ?? null,
      state: b.state ?? null,
      state_abbr: b.state_abbr ?? null,
      county: b.county ?? null,
      country: b.country ?? "United States",
      website: b.website ?? null,
      phone: b.phone ?? null,
      primary_email: b.primary_email ?? null,
      founded_year: b.founded_year ?? null,
      employee_count: b.employee_count ?? null,
      employee_count_source: b.employee_count ? "cim" : null,
      revenue_est_low: b.revenue_est_low ?? null,
      revenue_est_high: b.revenue_est_high ?? null,
      revenue_confidence: b.revenue_confidence ?? "medium",
      revenue_est_sources: ["cim"],
      revenue_verified: !!b.revenue_verified_value,
      revenue_verified_value: b.revenue_verified_value ?? null,
      revenue_verified_source: b.revenue_verified_value ? "cim" : null,
      revenue_verified_at: b.revenue_verified_value ? new Date().toISOString() : null,
      ebitda_margin_verified: b.ebitda_margin_verified ?? null,
      ebitda_verified: b.ebitda_margin_verified != null,
      in_crm: true,
      crm_stage: "cim_received",
      review_status: "reviewed",
      added_via: "manual_cim",
      last_activity_at: new Date().toISOString(),
    };

    const { data: newBiz, error: bizErr } = await admin
      .from("businesses")
      .insert(bizInsert)
      .select()
      .single();

    if (bizErr || !newBiz) {
      console.error("insert business error", bizErr);
      return json({ error: bizErr?.message ?? "failed to insert business" }, 500);
    }

    // Optional classification row
    if (Object.keys(c).length > 0) {
      const { error: clsErr } = await admin
        .from("business_classifications")
        .insert({
          business_id: newBiz.id,
          vertical: c.vertical ?? null,
          category: c.category ?? null,
          business_type: c.business_type ?? null,
          business_description: c.business_description ?? null,
          services_offered: c.services_offered ?? null,
          industry_keywords: c.industry_keywords ?? null,
          customer_type: c.customer_type ?? null,
          geographic_scope: c.geographic_scope ?? null,
          years_in_business: c.years_in_business ?? null,
          classified_by: "cim_extraction",
          classification_confidence: extracted.confidence ?? "medium",
        });
      if (clsErr) {
        console.warn("classification insert failed (non-fatal)", clsErr);
      }
    }

    // Activity log entry
    await admin.from("activities").insert({
      business_id: newBiz.id,
      type: "cim_uploaded",
      body: `Business created from CIM upload (${file_name ?? "file"}). Confidence: ${extracted.confidence ?? "medium"}.`,
    });

    return json({
      business: newBiz,
      cim_text_dump: extracted.cim_text_dump ?? "",
      confidence: extracted.confidence ?? "medium",
    });
  } catch (e: any) {
    console.error("extract-cim-business error", e);
    return json({ error: e?.message ?? "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
