const EWS_URL = "https://outlook.office365.com/EWS/Exchange.asmx";

export function encodeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function envelope(userEmail: string, bodyXml: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages"
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2016" />
    <t:ExchangeImpersonation>
      <t:ConnectingSID>
        <t:PrimarySmtpAddress>${encodeXml(userEmail)}</t:PrimarySmtpAddress>
      </t:ConnectingSID>
    </t:ExchangeImpersonation>
  </soap:Header>
  <soap:Body>
    ${bodyXml}
  </soap:Body>
</soap:Envelope>`;
}

export type EwsResult = { ok: boolean; xml: string; error?: string };

export async function ewsSoap(params: {
  userEmail: string;
  accessToken: string;
  action: string;
  bodyXml: string;
}): Promise<EwsResult> {
  const response = await fetch(EWS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `http://schemas.microsoft.com/exchange/services/2006/messages/${params.action}`,
      "X-AnchorMailbox": params.userEmail,
    },
    body: envelope(params.userEmail, params.bodyXml),
  });
  const xml = await response.text();
  const ok =
    response.ok &&
    (/ResponseClass="Success"/.test(xml) || /<m:ResponseCode>NoError<\/m:ResponseCode>/.test(xml)) &&
    !/<m:ResponseCode>Error/.test(xml);
  if (ok) return { ok: true, xml };
  const code = xml.match(/<m:ResponseCode>([^<]+)<\/m:ResponseCode>/)?.[1];
  return {
    ok: false,
    xml,
    error: `EWS ${params.action} failed (${response.status}${code ? ` ${code}` : ""}): ${xml.slice(0, 400)}`,
  };
}

export function parseFolderId(xml: string): { id: string; changeKey?: string } | null {
  const match = xml.match(/FolderId Id="([^"]+)"(?: ChangeKey="([^"]*)")?/);
  if (!match) return null;
  return { id: match[1], changeKey: match[2] };
}

export function parseItemId(xml: string): { id: string; changeKey?: string } | null {
  const match = xml.match(/ItemId Id="([^"]+)"(?: ChangeKey="([^"]*)")?/);
  if (!match) return null;
  return { id: match[1], changeKey: match[2] };
}

export async function findChildFolder(params: {
  userEmail: string;
  accessToken: string;
  parentXml: string;
  displayName: string;
}): Promise<{ id: string; changeKey?: string } | null> {
  const result = await ewsSoap({
    userEmail: params.userEmail,
    accessToken: params.accessToken,
    action: "FindFolder",
    bodyXml: `<m:FindFolder Traversal="Shallow">
      <m:FolderShape>
        <t:BaseShape>IdOnly</t:BaseShape>
        <t:AdditionalProperties>
          <t:FieldURI FieldURI="folder:DisplayName"/>
        </t:AdditionalProperties>
      </m:FolderShape>
      <m:IndexedPageFolderView MaxEntriesReturned="100" Offset="0" BasePoint="Beginning"/>
      <m:Restriction>
        <t:IsEqualTo>
          <t:FieldURI FieldURI="folder:DisplayName"/>
          <t:FieldURIOrConstant>
            <t:Constant Value="${encodeXml(params.displayName)}"/>
          </t:FieldURIOrConstant>
        </t:IsEqualTo>
      </m:Restriction>
      <m:ParentFolderIds>${params.parentXml}</m:ParentFolderIds>
    </m:FindFolder>`,
  });
  if (!result.ok) return null;
  return parseFolderId(result.xml);
}

export async function createFolder(params: {
  userEmail: string;
  accessToken: string;
  parentXml: string;
  displayName: string;
}): Promise<{ id: string; changeKey?: string } | null> {
  const result = await ewsSoap({
    userEmail: params.userEmail,
    accessToken: params.accessToken,
    action: "CreateFolder",
    bodyXml: `<m:CreateFolder>
      <m:ParentFolderId>${params.parentXml}</m:ParentFolderId>
      <m:Folders>
        <t:Folder>
          <t:DisplayName>${encodeXml(params.displayName)}</t:DisplayName>
        </t:Folder>
      </m:Folders>
    </m:CreateFolder>`,
  });
  if (result.ok) return parseFolderId(result.xml);
  return findChildFolder(params);
}

export async function ensureChildFolder(params: {
  userEmail: string;
  accessToken: string;
  parentXml: string;
  displayName: string;
}): Promise<{ id: string; changeKey?: string } | null> {
  const existing = await findChildFolder(params);
  if (existing) return existing;
  return createFolder(params);
}

export function folderIdXml(folder: { id: string; changeKey?: string }): string {
  return folder.changeKey
    ? `<t:FolderId Id="${encodeXml(folder.id)}" ChangeKey="${encodeXml(folder.changeKey)}" />`
    : `<t:FolderId Id="${encodeXml(folder.id)}" />`;
}

const RAWJSON_SET = "2842957E-8ED9-439B-99B5-F681924BD972";

export async function findItemBySubject(params: {
  userEmail: string;
  accessToken: string;
  folder: { id: string; changeKey?: string };
  subject: string;
}): Promise<{ id: string; changeKey?: string } | null> {
  const result = await ewsSoap({
    userEmail: params.userEmail,
    accessToken: params.accessToken,
    action: "FindItem",
    bodyXml: `<m:FindItem Traversal="Shallow">
      <m:ItemShape>
        <t:BaseShape>IdOnly</t:BaseShape>
        <t:AdditionalProperties>
          <t:FieldURI FieldURI="item:Subject"/>
        </t:AdditionalProperties>
      </m:ItemShape>
      <m:IndexedPageItemView MaxEntriesReturned="50" Offset="0" BasePoint="Beginning"/>
      <m:Restriction>
        <t:IsEqualTo>
          <t:FieldURI FieldURI="item:Subject"/>
          <t:FieldURIOrConstant>
            <t:Constant Value="${encodeXml(params.subject)}"/>
          </t:FieldURIOrConstant>
        </t:IsEqualTo>
      </m:Restriction>
      <m:ParentFolderIds>${folderIdXml(params.folder)}</m:ParentFolderIds>
    </m:FindItem>`,
  });
  if (!result.ok) return null;
  return parseItemId(result.xml);
}

export async function upsertRoamingItem(params: {
  userEmail: string;
  accessToken: string;
  folder: { id: string; changeKey?: string };
  itemClass: string;
  subject: string;
  rawJson: string;
}): Promise<EwsResult> {
  const existing = await findItemBySubject({
    userEmail: params.userEmail,
    accessToken: params.accessToken,
    folder: params.folder,
    subject: params.subject,
  });
  const jsonXml = encodeXml(params.rawJson);
  const extended = `<t:ExtendedProperty>
          <t:ExtendedFieldURI PropertySetId="${RAWJSON_SET}" PropertyName="RawJSON" PropertyType="String"/>
          <t:Value>${jsonXml}</t:Value>
        </t:ExtendedProperty>`;

  if (existing) {
    return ewsSoap({
      userEmail: params.userEmail,
      accessToken: params.accessToken,
      action: "UpdateItem",
      bodyXml: `<m:UpdateItem ConflictResolution="AlwaysOverwrite" MessageDisposition="SaveOnly">
        <m:ItemChanges>
          <t:ItemChange>
            <t:ItemId Id="${encodeXml(existing.id)}"${existing.changeKey ? ` ChangeKey="${encodeXml(existing.changeKey)}"` : ""}/>
            <t:Updates>
              <t:SetItemField>
                <t:ExtendedFieldURI PropertySetId="${RAWJSON_SET}" PropertyName="RawJSON" PropertyType="String"/>
                <t:Message>${extended}</t:Message>
              </t:SetItemField>
            </t:Updates>
          </t:ItemChange>
        </m:ItemChanges>
      </m:UpdateItem>`,
    });
  }

  return ewsSoap({
    userEmail: params.userEmail,
    accessToken: params.accessToken,
    action: "CreateItem",
    bodyXml: `<m:CreateItem MessageDisposition="SaveOnly">
      <m:SavedItemFolderId>${folderIdXml(params.folder)}</m:SavedItemFolderId>
      <m:Items>
        <t:Message>
          <t:ItemClass>${encodeXml(params.itemClass)}</t:ItemClass>
          <t:Subject>${encodeXml(params.subject)}</t:Subject>
          ${extended}
        </t:Message>
      </m:Items>
    </m:CreateItem>`,
  });
}
