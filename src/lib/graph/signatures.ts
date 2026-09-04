import type { AzureTenantConfig, InjectResult } from "@/types";
import { getAccessToken, getGraphClient } from "./client";

function encodeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildSignatureEwsRequest(
  userEmail: string,
  htmlContent: string,
  signatureName: string
): string {
  const encodedHtml = Buffer.from(htmlContent, "utf8").toString("base64");
  const encodedName = encodeXml(signatureName);
  const encodedEmail = encodeXml(userEmail);

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages"
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2016" />
    <t:ExchangeImpersonation>
      <t:ConnectingSID>
        <t:PrimarySmtpAddress>${encodedEmail}</t:PrimarySmtpAddress>
      </t:ConnectingSID>
    </t:ExchangeImpersonation>
  </soap:Header>
  <soap:Body>
    <m:UpdateUserConfiguration>
      <m:UserConfiguration>
        <t:UserConfigurationName Name="OWA.UserOptions">
          <t:DistinguishedFolderId Id="root" />
        </t:UserConfigurationName>
        <t:Dictionary>
          <t:DictionaryEntry>
            <t:DictionaryKey>
              <t:Type>String</t:Type>
              <t:Value>signaturehtml</t:Value>
            </t:DictionaryKey>
            <t:DictionaryValue>
              <t:Type>String</t:Type>
              <t:Value>${encodedHtml}</t:Value>
            </t:DictionaryValue>
          </t:DictionaryEntry>
          <t:DictionaryEntry>
            <t:DictionaryKey>
              <t:Type>String</t:Type>
              <t:Value>autoaddsignature</t:Value>
            </t:DictionaryKey>
            <t:DictionaryValue>
              <t:Type>Boolean</t:Type>
              <t:Value>true</t:Value>
            </t:DictionaryValue>
          </t:DictionaryEntry>
          <t:DictionaryEntry>
            <t:DictionaryKey>
              <t:Type>String</t:Type>
              <t:Value>autoaddsignatureonreply</t:Value>
            </t:DictionaryKey>
            <t:DictionaryValue>
              <t:Type>Boolean</t:Type>
              <t:Value>true</t:Value>
            </t:DictionaryValue>
          </t:DictionaryEntry>
          <t:DictionaryEntry>
            <t:DictionaryKey>
              <t:Type>String</t:Type>
              <t:Value>signaturetext</t:Value>
            </t:DictionaryKey>
            <t:DictionaryValue>
              <t:Type>String</t:Type>
              <t:Value>${encodedName}</t:Value>
            </t:DictionaryValue>
          </t:DictionaryEntry>
        </t:Dictionary>
      </m:UserConfiguration>
    </m:UpdateUserConfiguration>
  </soap:Body>
</soap:Envelope>`;
}

async function tryOutlookRestV2(params: {
  userId: string;
  htmlContent: string;
  signatureName: string;
  accessToken: string;
}): Promise<boolean> {
  const response = await fetch(
    `https://outlook.office365.com/api/v2.0/users/${encodeURIComponent(params.userId)}/MailboxSettings`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        SignatureHtml: params.htmlContent,
        AutoAddSignature: true,
        SignatureForNewMessage: params.signatureName,
        SignatureForReply: params.signatureName,
      }),
    }
  );
  return response.ok;
}

async function tryGraphMailboxSettings(params: {
  userId: string;
  htmlContent: string;
  signatureName: string;
  tenantConfig: AzureTenantConfig;
}): Promise<boolean> {
  const client = await getGraphClient(params.tenantConfig);
  await client.api(`/users/${params.userId}/mailboxSettings`).patch({
    signatureHtml: params.htmlContent,
    autoAddSignature: true,
    signatureForNewMessage: params.signatureName,
    signatureForReply: params.signatureName,
  });
  return true;
}

async function tryEwsSoap(params: {
  userEmail: string;
  htmlContent: string;
  signatureName: string;
  accessToken: string;
}): Promise<boolean> {
  const soapBody = buildSignatureEwsRequest(
    params.userEmail,
    params.htmlContent,
    params.signatureName
  );
  const response = await fetch("https://outlook.office365.com/EWS/Exchange.asmx", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction:
        "http://schemas.microsoft.com/exchange/services/2006/messages/UpdateUserConfiguration",
      "X-AnchorMailbox": params.userEmail,
    },
    body: soapBody,
  });
  if (!response.ok) return false;
  const text = await response.text();
  if (/<m:ResponseCode>NoError<\/m:ResponseCode>/.test(text) || /ResponseClass="Success"/.test(text)) {
    return true;
  }
  if (response.ok && !/<m:ResponseCode>Error/.test(text)) {
    return true;
  }
  return false;
}

export async function injectSignatureForUser(params: {
  userId: string;
  userEmail: string;
  htmlContent: string;
  signatureName: string;
  tenantConfig: AzureTenantConfig;
}): Promise<InjectResult> {
  let outlookToken: string | null = null;
  try {
    outlookToken = await getAccessToken(params.tenantConfig, "outlook");
  } catch {
    outlookToken = null;
  }

  if (outlookToken) {
    try {
      const ok = await tryOutlookRestV2({
        userId: params.userId,
        htmlContent: params.htmlContent,
        signatureName: params.signatureName,
        accessToken: outlookToken,
      });
      if (ok) return { success: true, method: "outlook-rest-v2" };
    } catch {
      /* fall through */
    }
  }

  try {
    const ok = await tryGraphMailboxSettings({
      userId: params.userId,
      htmlContent: params.htmlContent,
      signatureName: params.signatureName,
      tenantConfig: params.tenantConfig,
    });
    if (ok) return { success: true, method: "graph-mailboxsettings" };
  } catch {
    /* fall through */
  }

  if (outlookToken) {
    try {
      const ok = await tryEwsSoap({
        userEmail: params.userEmail,
        htmlContent: params.htmlContent,
        signatureName: params.signatureName,
        accessToken: outlookToken,
      });
      if (ok) return { success: true, method: "ews-soap" };
    } catch {
      /* fall through */
    }
  }

  return {
    success: false,
    method: "none",
    error:
      "All injection methods failed (Outlook REST v2, Graph mailboxSettings, EWS SOAP). Confirm application permissions Mail.ReadWrite, MailboxSettings.ReadWrite, and Exchange full_access_as_app are granted with admin consent.",
  };
}
