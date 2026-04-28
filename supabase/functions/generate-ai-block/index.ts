// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `You are a skilled writer helping a search fund investor write personalized acquisition outreach letters to small business owners.

You are writing ONE specific passage within a larger letter — not the full letter itself. Write in first person as the investor.

Rules:
- Be genuine, specific, and direct — not effusive or salesy
- Sound like a person who actually looked up this business, not like a marketing script
- Never explicitly mention buying, acquiring, or selling the business
- Never use flattering filler phrases like "impressive track record" or "outstanding reputation"
- Stick strictly to the business context provided — do not invent or assume any facts not given
- Respect the tier constraints:
  - Tier 1 (Business Only): Reference only public business-level signals. Do not reference the owner as an individual.
  - Tier 2 (Business + Owner): You may reference the owner by name once, naturally, through the lens of what they have built professionally.
  - Tier 3 (Full Context): Draw on call notes and personal context the owner would recognize and feel acknowledged by — not surveilled.

Output ONLY the requested passage — no preamble, no label, no sign-off, no quotation marks around the output.`;

function buildContext(params: {
  biz: any;
  cls: any;
  contacts: any[];
  memos: any[];
  tier: number;
}): string {
  const { biz, cls, contacts, memos, tier } = params;
  const owner = contacts?.find((c) => c.is_owner);
  const yearsOp = biz?.founded_year
    ? `${new Date().getFullYear() - biz.founded_year}+ years`
    : null;

  const lines: string[] = [
    `Business Name: ${biz?.name ?? "Unknown"}`,
    `Vertical: ${cls?.vertical ?? "Unknown"}`,
    `Business Type: ${cls?.business_type ?? "Unknown"}`,
    `Location: ${[biz?.county, biz?.state_abbr].filter(Boolean).join(", ") || "Unknown"}`,
    yearsOp ? `Years Operating: ${yearsOp}` : null,
    biz?.rating ? `Google Rating: ${biz.rating}/5 (${biz.review_count ?? "?"} reviews)` : null,
    biz?.employee_count ? `Employees: ~${biz.employee_count}` : null,
    biz?.website ? `Website: ${biz.website}` : null,
    cls?.business_description ? `Description: ${cls.business_description}` : null,
    cls?.services_offered ? `Services: ${cls.services_offered}` : null,
  ].filter(Boolean) as string[];

  if (tier >= 2 && owner) {
    lines.push(`Owner Name: ${owner.name}`);
    if (owner.role) lines.push(`Owner Role: ${owner.role}`);
  }

  if (tier >= 3) {
    const contactWithNotes = contacts?.find((c) => c.notes?.trim());
    if (contactWithNotes) {
      lines.push(`Contact Notes: ${contactWithNotes.notes}`);
    }
    const memo = memos?.[0];
    if (memo?.sections?.business_overview?.summary) {
      lines.push(`Business Overview: ${memo.sections.business_overview.summary}`);
    }
    if (memo?.sections?.management_team?.summary) {
      lines.push(`Owner / Management Context: ${memo.sections.management_team.summary}`);
    }
  }

  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { business_id, block_prompt, tier } = body ?? {};

    if (!business_id || !block_prompt) {
      return json({ error: "business_id and block_prompt are required" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const [bizRes, clsRes, contactsRes, memosRes] = await Promise.all([
      admin
        .from("businesses")
        .select("id, name, county, state_abbr, website, rating, review_count, employee_count, founded_year")
        .eq("id", business_id)
        .single(),
      admin
        .from("business_classifications")
        .select("vertical, category, business_type, services_offered, business_description")
        .eq("business_id", business_id)
        .maybeSingle(),
      admin
        .from("contacts")
        .select("name, role, is_owner, notes")
        .eq("business_id", business_id),
      admin
        .from("dd_memos")
        .select("sections")
        .eq("business_id", business_id)
        .limit(1),
    ]);

    if (bizRes.error || !bizRes.data) {
      return json({ error: "Business not found" }, 404);
    }

    const context = buildContext({
      biz: bizRes.data,
      cls: clsRes.data,
      contacts: contactsRes.data ?? [],
      memos: memosRes.data ?? [],
      tier: tier ?? 1,
    });

    const tierLabel =
      tier === 3 ? "Tier 3 (Full Context)" :
      tier === 2 ? "Tier 2 (Business + Owner)" :
      "Tier 1 (Business Only)";

    const userPrompt = `Personalisation tier: ${tierLabel}

Business context:
${context}

Your instructions:
${block_prompt}`;

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
        max_tokens: 350,
        temperature: 0.7,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error", aiResp.status, errText);
      if (aiResp.status === 429) return json({ error: "Rate limit exceeded. Please retry." }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted." }, 402);
      return json({ error: "AI gateway error" }, 500);
    }

    const aiJson = await aiResp.json();
    const text = aiJson?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      return json({ error: "AI returned empty content" }, 500);
    }

    return json({ text });
  } catch (err) {
    console.error("generate-ai-block error", err);
    return json({ error: "Internal server error" }, 500);
  }
});
