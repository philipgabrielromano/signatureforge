import { htmlToPlainText } from "@/lib/utils";
import {
  ensureChildFolder,
  findChildFolder,
  folderIdXml,
  upsertRoamingItem,
} from "@/lib/graph/ews";

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

  if (write.ok) {
    await cloudFetch(ACCOUNT_URLS(email), {
      method: "PATCH",
      headers,
      body: defaultsBody,
    });
    return { ok: true };
  }

  const owsError = `OWS roaming write failed (${write.status} ${write.url}): ${write.body.slice(0, 300)}`;
  console.warn("[roaming]", owsError);

  const ews = await tryEwsRoamingStore({
    userEmail: email,
    accessToken: params.accessToken,
    htmlContent: params.htmlContent,
    text,
    name,
    listValue: mergedList,
  });
  if (ews.ok) return { ok: true };
  return { ok: false, error: `${owsError} | ${ews.error}` };
}

const SDS_CLASS = "SDS.49499048-0129-47f5-b95e-f9d315b861a6.RoamingSetting";
const APP_GUID = "49499048-0129-47f5-b95e-f9d315b861a6";

async function tryEwsRoamingStore(params: {
  userEmail: string;
  accessToken: string;
  htmlContent: string;
  text: string;
  name: string;
  listValue: string;
}): Promise<{ ok: boolean; error?: string }> {
  const rootXml = `<t:DistinguishedFolderId Id="root"/>`;
  const appRoot =
    (await findChildFolder({
      userEmail: params.userEmail,
      accessToken: params.accessToken,
      parentXml: rootXml,
      displayName: "ApplicationDataRoot",
    })) ||
    (await findChildFolder({
      userEmail: params.userEmail,
      accessToken: params.accessToken,
      parentXml: rootXml,
      displayName: "Application Data",
    }));
  if (!appRoot) return { ok: false, error: "EWS roaming: ApplicationDataRoot not found" };

  const guidFolder = await ensureChildFolder({
    userEmail: params.userEmail,
    accessToken: params.accessToken,
    parentXml: folderIdXml(appRoot),
    displayName: APP_GUID,
  });
  if (!guidFolder) return { ok: false, error: "EWS roaming: app settings folder not found" };

  const accountFolder = await ensureChildFolder({
    userEmail: params.userEmail,
    accessToken: params.accessToken,
    parentXml: folderIdXml(guidFolder),
    displayName: "OutlookAccountCloudSettings",
  });
  if (!accountFolder) return { ok: false, error: "EWS roaming: OutlookAccountCloudSettings not found" };

  const encodedName = Buffer.from(params.name, "utf8").toString("base64");
  const accountParent = folderIdXml(accountFolder);
  const signatureFolder =
    (await ensureChildFolder({
      userEmail: params.userEmail,
      accessToken: params.accessToken,
      parentXml: accountParent,
      displayName: encodedName,
    })) ||
    (await ensureChildFolder({
      userEmail: params.userEmail,
      accessToken: params.accessToken,
      parentXml: accountParent,
      displayName: params.name,
    }));
  if (!signatureFolder) return { ok: false, error: "EWS roaming: could not create signature folder" };

  const setting = (fields: Record<string, unknown>) =>
    JSON.stringify({
      itemClass: "RoamingSetting",
      scope: params.userEmail,
      source: "UserOverride",
      ...fields,
    });

  const writes = [
    upsertRoamingItem({
      userEmail: params.userEmail,
      accessToken: params.accessToken,
      folder: signatureFolder,
      itemClass: SDS_CLASS,
      subject: "htm",
      rawJson: setting({
        name: params.name,
        parentSetting: "roaming_signature_list",
        secondaryKey: "htm",
        type: "Blob",
        value: params.htmlContent,
      }),
    }),
    upsertRoamingItem({
      userEmail: params.userEmail,
      accessToken: params.accessToken,
      folder: signatureFolder,
      itemClass: SDS_CLASS,
      subject: "txt",
      rawJson: setting({
        name: params.name,
        parentSetting: "roaming_signature_list",
        secondaryKey: "txt",
        type: "Blob",
        value: params.text,
      }),
    }),
    upsertRoamingItem({
      userEmail: params.userEmail,
      accessToken: params.accessToken,
      folder: accountFolder,
      itemClass: SDS_CLASS,
      subject: "roaming_signature_list",
      rawJson: setting({
        name: "roaming_signature_list",
        secondaryKey: "roaming_signature_list",
        type: "BlobArray",
        value: params.listValue,
      }),
    }),
    upsertRoamingItem({
      userEmail: params.userEmail,
      accessToken: params.accessToken,
      folder: accountFolder,
      itemClass: SDS_CLASS,
      subject: "roaming_new_signature",
      rawJson: setting({
        name: "roaming_new_signature",
        type: "String",
        value: params.name,
      }),
    }),
    upsertRoamingItem({
      userEmail: params.userEmail,
      accessToken: params.accessToken,
      folder: accountFolder,
      itemClass: SDS_CLASS,
      subject: "roaming_reply_signature",
      rawJson: setting({
        name: "roaming_reply_signature",
        type: "String",
        value: params.name,
      }),
    }),
  ];

  const results = await Promise.all(writes);
  const failed = results.find((result) => !result.ok);
  if (failed) return { ok: false, error: failed.error };
  return { ok: true };
}
