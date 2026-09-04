import { htmlToPlainText } from "@/lib/utils";

type CloudSetting = {
  name?: string;
  value?: string;
  secondaryKey?: string;
};

function signatureListName(name: string): string {
  return name.replaceAll(",", " ").replace(/\s+/g, " ").trim().slice(0, 120) || "SignatureForge";
}

function ticksNow(): number {
  return Date.now() * 10000 + 621355968000000000;
}

function mergeSignatureNames(existing: string | undefined, name: string): string {
  const names = (existing || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!names.some((item) => item.toLowerCase() === name.toLowerCase())) {
    names.push(name);
  }
  return names.join(",");
}

function settingValue(settings: CloudSetting[], name: string): string | undefined {
  return settings.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value;
}

function parseSettings(payload: unknown): CloudSetting[] {
  if (Array.isArray(payload)) return payload as CloudSetting[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { value?: unknown }).value)) {
    return (payload as { value: CloudSetting[] }).value;
  }
  return [];
}

function cloudHeaders(token: string, email: string, large: boolean): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-AnchorMailbox": `SMTP:${email}`,
    "X-OWA-ExplicitLogonUser": email,
    "X-RoutingParameter-SessionKey": `SMTP:${email}`,
    "x-islargesetting": large ? "true" : "false",
    "x-overridetimestamp": "true",
  };
}

const ACCOUNT_URLS = (email: string) => [
  `https://outlook.office.com/ows/${encodeURIComponent(email)}/v1/OutlookCloudSettings/settings/account`,
  "https://outlook.office.com/ows/v1/OutlookCloudSettings/settings/account",
  "https://outlook.office.com/ows/beta/OutlookCloudSettings/settings",
  "https://substrate.office.com/ows/beta/outlookcloudsettings/settings/account?fromows=true",
];

const GET_URLS = (email: string) => [
  `https://outlook.office.com/ows/${encodeURIComponent(email)}/v1/OutlookCloudSettings/settings?settingname=roaming_signature_list,roaming_new_signature,roaming_reply_signature`,
  "https://outlook.office.com/ows/v1/OutlookCloudSettings/settings/account?settingname=roaming_signature_list,roaming_new_signature,roaming_reply_signature",
  "https://outlook.office.com/ows/beta/OutlookCloudSettings/settings?settingname=roaming_signature_list,roaming_new_signature,roaming_reply_signature",
];

async function cloudFetch(
  urls: string[],
  init: RequestInit
): Promise<{ ok: boolean; status: number; body: string; url: string }> {
  let last = { ok: false, status: 0, body: "No endpoints attempted", url: "" };
  for (const url of urls) {
    const response = await fetch(url, init);
    const body = await response.text();
    last = { ok: response.ok, status: response.status, body, url };
    if (response.ok) return last;
  }
  return last;
}

export async function tryRoamingSignatures(params: {
  userEmail: string;
  htmlContent: string;
  signatureName: string;
  accessToken: string;
}): Promise<{ ok: boolean; error?: string }> {
  const email = params.userEmail;
  const name = signatureListName(params.signatureName);
  const headers = cloudHeaders(params.accessToken, email, false);
  const largeHeaders = cloudHeaders(params.accessToken, email, true);

  const existing = await cloudFetch(GET_URLS(email), { method: "GET", headers });
  let listValue = "";
  if (existing.ok) {
    try {
      listValue = settingValue(parseSettings(JSON.parse(existing.body)), "roaming_signature_list") || "";
    } catch {
      listValue = "";
    }
  }

  const mergedList = mergeSignatureNames(listValue, name);
  const text = htmlToPlainText(params.htmlContent);

  const contentBody = () =>
    JSON.stringify([
      {
        itemClass: "RoamingSetting",
        metadata: "encoding:utf-8",
        name,
        parentSetting: "roaming_signature_list",
        scope: email,
        secondaryKey: "htm",
        timestamp: ticksNow(),
        type: "Blob",
        value: params.htmlContent,
        "value@is.Large": true,
        source: "UserOverride",
      },
      {
        itemClass: "RoamingSetting",
        metadata: "encoding:utf-8",
        name,
        parentSetting: "roaming_signature_list",
        scope: email,
        secondaryKey: "txt",
        timestamp: ticksNow(),
        type: "Blob",
        value: text,
        "value@is.Large": true,
        source: "UserOverride",
      },
    ]);

  const defaultsBody = JSON.stringify([
    {
      itemClass: "RoamingSetting",
      name: "roaming_signature_list",
      scope: email,
      secondaryKey: "roaming_signature_list",
      type: "BlobArray",
      value: mergedList,
      source: "UserOverride",
    },
    {
      itemClass: "RoamingSetting",
      name: "roaming_new_signature",
      scope: email,
      type: "String",
      value: name,
      source: "UserOverride",
    },
    {
      itemClass: "RoamingSetting",
      name: "roaming_reply_signature",
      scope: email,
      type: "String",
      value: name,
      source: "UserOverride",
    },
  ]);

  let write = await cloudFetch(ACCOUNT_URLS(email), {
    method: "PATCH",
    headers: largeHeaders,
    body: contentBody(),
  });

  if (!write.ok) {
    await cloudFetch(ACCOUNT_URLS(email), {
      method: "POST",
      headers: largeHeaders,
      body: JSON.stringify([
        {
          itemClass: "RoamingSetting",
          name: "roaming_signature_list",
          scope: email,
          secondaryKey: "roaming_signature_list",
          type: "BlobArray",
          value: name,
          source: "UserOverride",
        },
      ]),
    });
    write = await cloudFetch(ACCOUNT_URLS(email), {
      method: "PATCH",
      headers: largeHeaders,
      body: contentBody(),
    });
  }

  if (!write.ok) {
    return {
      ok: false,
      error: `Roaming signature write failed (${write.status} ${write.url}): ${write.body.slice(0, 400)}`,
    };
  }

  await cloudFetch(ACCOUNT_URLS(email), {
    method: "PATCH",
    headers,
    body: defaultsBody,
  });

  return { ok: true };
}
