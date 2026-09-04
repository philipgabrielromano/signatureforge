import { htmlToPlainText } from "@/lib/utils";
import {
  ensureChildFolder,
  findChildFolder,
  folderIdXml,
  upsertRoamingItem,
} from "@/lib/graph/ews";

function signatureListName(name: string): string {
  return name.replaceAll(",", " ").replace(/\s+/g, " ").trim().slice(0, 120) || "SignatureForge";
}

/**
 * App-only tokens cannot call OutlookCloudSettings / substrate OWS (always 401).
 * Modern OWA and New Outlook read SDS items in ApplicationDataRoot instead.
 */
export async function tryRoamingSignatures(params: {
  userEmail: string;
  htmlContent: string;
  signatureName: string;
  accessToken: string;
}): Promise<{ ok: boolean; error?: string }> {
  const name = signatureListName(params.signatureName);
  const text = htmlToPlainText(params.htmlContent);
  return tryEwsRoamingStore({
    userEmail: params.userEmail,
    accessToken: params.accessToken,
    htmlContent: params.htmlContent,
    text,
    name,
    listValue: name,
  });
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
    {
      folder: signatureFolder,
      subject: "htm",
      bodyHtml: params.htmlContent,
      rawJson: setting({
        name: params.name,
        parentSetting: "roaming_signature_list",
        secondaryKey: "htm",
        type: "Blob",
        value: params.htmlContent,
      }),
    },
    {
      folder: signatureFolder,
      subject: "txt",
      rawJson: setting({
        name: params.name,
        parentSetting: "roaming_signature_list",
        secondaryKey: "txt",
        type: "Blob",
        value: params.text,
      }),
    },
    {
      folder: accountFolder,
      subject: "roaming_signature_list",
      rawJson: setting({
        name: "roaming_signature_list",
        secondaryKey: "roaming_signature_list",
        type: "BlobArray",
        value: params.listValue,
      }),
    },
    {
      folder: accountFolder,
      subject: "roaming_new_signature",
      rawJson: setting({
        name: "roaming_new_signature",
        type: "String",
        value: params.name,
      }),
    },
    {
      folder: accountFolder,
      subject: "roaming_reply_signature",
      rawJson: setting({
        name: "roaming_reply_signature",
        type: "String",
        value: params.name,
      }),
    },
  ];

  for (const write of writes) {
    const result = await upsertRoamingItem({
      userEmail: params.userEmail,
      accessToken: params.accessToken,
      folder: write.folder,
      itemClass: SDS_CLASS,
      subject: write.subject,
      rawJson: write.rawJson,
      bodyHtml: write.bodyHtml,
    });
    if (!result.ok) return { ok: false, error: result.error };
  }
  return { ok: true };
}
