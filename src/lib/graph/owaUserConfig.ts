import { htmlToPlainText } from "@/lib/utils";

const GRAPH_BETA = "https://graph.microsoft.com/beta";

type TypedValue = { type?: string; values?: string[] };
type StructuredEntry = { keyEntry?: TypedValue; valueEntry?: TypedValue };

function entry(key: string, type: "string" | "boolean", value: string): StructuredEntry {
  return {
    keyEntry: { type: "string", values: [key] },
    valueEntry: { type, values: [value] },
  };
}

function entryKey(item: StructuredEntry): string {
  return (item.keyEntry?.values?.[0] ?? "").toLowerCase();
}

/**
 * Writes the classic OWA signature via the Graph userConfiguration API
 * (the EWS UserConfiguration replacement; EWS is blocked in EXO from Oct 2026).
 * Requires the MailboxConfigItem.ReadWrite application permission.
 * PATCH replaces the whole dictionary, so existing entries are merged in.
 */
export async function tryGraphUserConfig(params: {
  userId: string;
  htmlContent: string;
  accessToken: string;
}): Promise<{ ok: boolean; error?: string }> {
  const base = `${GRAPH_BETA}/users/${encodeURIComponent(params.userId)}/mailFolders/msgfolderroot/userConfigurations`;
  const url = `${base}/OWA.UserOptions`;
  const headers = {
    Authorization: `Bearer ${params.accessToken}`,
    "Content-Type": "application/json",
  };

  const ours: StructuredEntry[] = [
    entry("signaturehtml", "string", params.htmlContent),
    entry("signaturetext", "string", htmlToPlainText(params.htmlContent)),
    entry("autoaddsignature", "boolean", "true"),
    entry("autoaddsignatureonreply", "boolean", "true"),
  ];
  const ourKeys = new Set(ours.map(entryKey));

  try {
    const existing = await fetch(url, { headers: { Authorization: headers.Authorization } });

    if (existing.status === 404) {
      const created = await fetch(base, {
        method: "POST",
        headers,
        body: JSON.stringify({
          "@odata.type": "#microsoft.graph.userConfiguration",
          id: "OWA.UserOptions",
          structuredData: ours,
        }),
      });
      if (created.ok) return { ok: true };
      const body = await created.text();
      return {
        ok: false,
        error: `Graph userConfiguration create failed (${created.status}): ${body.slice(0, 300)}`,
      };
    }

    if (!existing.ok) {
      const body = await existing.text();
      return {
        ok: false,
        error: `Graph userConfiguration read failed (${existing.status}): ${body.slice(0, 300)}`,
      };
    }

    const current = (await existing.json()) as { structuredData?: StructuredEntry[] };
    const kept = (current.structuredData ?? []).filter(
      (item) => entryKey(item) && !ourKeys.has(entryKey(item))
    );

    const updated = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ structuredData: [...kept, ...ours] }),
    });
    if (updated.ok) return { ok: true };
    const body = await updated.text();
    return {
      ok: false,
      error: `Graph userConfiguration update failed (${updated.status}): ${body.slice(0, 300)}`,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
