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

function soapError(action: string, status: number, xml: string): string {
  const code = xml.match(/<(?:m:)?ResponseCode>([^<]+)<\/(?:m:)?ResponseCode>/)?.[1];
  const message = xml.match(/<(?:m:)?MessageText>([^<]+)<\/(?:m:)?MessageText>/)?.[1];
  const innerCode = xml.match(/Name="InnerErrorResponseCode">([^<]+)/)?.[1];
  const innerMessage = xml.match(/Name="InnerErrorMessageText">([^<]+)/)?.[1];
  const parts = [`EWS ${action} failed (${status}`];
  if (code) parts.push(` ${code}`);
  parts.push(")");
  if (message) parts.push(`: ${message}`);
  if (innerCode || innerMessage) {
    parts.push(` [${[innerCode, innerMessage].filter(Boolean).join(": ")}]`);
  }
  return parts.join("");
}

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
    (/ResponseClass="Success"/.test(xml) || /<(?:m:)?ResponseCode>NoError<\/(?:m:)?ResponseCode>/.test(xml)) &&
    !/<(?:m:)?ResponseCode>Error/.test(xml);
  if (ok) return { ok: true, xml };
  return {
    ok: false,
    xml,
    error: soapError(params.action, response.status, xml),
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
const ASSOCIATED_PROP = `<t:ExtendedProperty>
          <t:ExtendedFieldURI PropertyTag="0x67AA" PropertyType="Boolean"/>
          <t:Value>true</t:Value>
        </t:ExtendedProperty>`;

export async function findItemBySubject(params: {
  userEmail: string;
  accessToken: string;
  folder: { id: string; changeKey?: string };
  subject: string;
}): Promise<{ id: string; changeKey?: string } | null> {
  // Contents table first — roaming signature HTML lives there, not as FAIs.
  for (const traversal of ["Shallow", "Associated"] as const) {
    const result = await ewsSoap({
      userEmail: params.userEmail,
      accessToken: params.accessToken,
      action: "FindItem",
      bodyXml: `<m:FindItem Traversal="${traversal}">
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
    if (result.ok) {
      const id = parseItemId(result.xml);
      if (id) return id;
    }
  }
  return null;
}

function rawJsonProperty(rawJson: string): string {
  return `<t:ExtendedProperty>
            <t:ExtendedFieldURI PropertySetId="${RAWJSON_SET}" PropertyName="RawJSON" PropertyType="String"/>
            <t:Value>${encodeXml(rawJson)}</t:Value>
          </t:ExtendedProperty>`;
}

function itemInner(params: {
  itemClass: string;
  subject: string;
  rawJson: string;
  bodyHtml?: string;
  associated?: boolean;
}): string {
  const body = params.bodyHtml
    ? `<t:Body BodyType="HTML">${encodeXml(params.bodyHtml)}</t:Body>`
    : "";
  return `<t:ItemClass>${encodeXml(params.itemClass)}</t:ItemClass>
          <t:Subject>${encodeXml(params.subject)}</t:Subject>
          ${body}
          ${params.associated ? ASSOCIATED_PROP : ""}
          ${rawJsonProperty(params.rawJson)}`;
}

async function createFolderItem(params: {
  userEmail: string;
  accessToken: string;
  folder: { id: string; changeKey?: string };
  wrapper: "Item" | "Message" | "PostItem";
  messageDisposition?: boolean;
  itemClass: string;
  subject: string;
  rawJson: string;
  bodyHtml?: string;
  associated?: boolean;
}): Promise<EwsResult> {
  const disposition = params.messageDisposition ? ` MessageDisposition="SaveOnly"` : "";
  const inner = itemInner(params);
  const wrapped =
    params.wrapper === "Message"
      ? `<t:Message>${inner}</t:Message>`
      : params.wrapper === "PostItem"
        ? `<t:PostItem>${inner}</t:PostItem>`
        : `<t:Item>${inner}</t:Item>`;
  return ewsSoap({
    userEmail: params.userEmail,
    accessToken: params.accessToken,
    action: "CreateItem",
    bodyXml: `<m:CreateItem${disposition}>
      <m:SavedItemFolderId>${folderIdXml(params.folder)}</m:SavedItemFolderId>
      <m:Items>
        ${wrapped}
      </m:Items>
    </m:CreateItem>`,
  });
}

async function updateItemClass(params: {
  userEmail: string;
  accessToken: string;
  item: { id: string; changeKey?: string };
  itemClass: string;
}): Promise<EwsResult> {
  return ewsSoap({
    userEmail: params.userEmail,
    accessToken: params.accessToken,
    action: "UpdateItem",
    bodyXml: `<m:UpdateItem ConflictResolution="AlwaysOverwrite">
      <m:ItemChanges>
        <t:ItemChange>
          <t:ItemId Id="${encodeXml(params.item.id)}"${params.item.changeKey ? ` ChangeKey="${encodeXml(params.item.changeKey)}"` : ""}/>
          <t:Updates>
            <t:SetItemField>
              <t:FieldURI FieldURI="item:ItemClass"/>
              <t:Item>
                <t:ItemClass>${encodeXml(params.itemClass)}</t:ItemClass>
              </t:Item>
            </t:SetItemField>
          </t:Updates>
        </t:ItemChange>
      </m:ItemChanges>
    </m:UpdateItem>`,
  });
}

export async function upsertRoamingItem(params: {
  userEmail: string;
  accessToken: string;
  folder: { id: string; changeKey?: string };
  itemClass: string;
  subject: string;
  rawJson: string;
  bodyHtml?: string;
}): Promise<EwsResult> {
  const existing = await findItemBySubject({
    userEmail: params.userEmail,
    accessToken: params.accessToken,
    folder: params.folder,
    subject: params.subject,
  });

  if (existing) {
    const updates: string[] = [
      `<t:SetItemField>
                <t:ExtendedFieldURI PropertySetId="${RAWJSON_SET}" PropertyName="RawJSON" PropertyType="String"/>
                <t:Item>
                  ${rawJsonProperty(params.rawJson)}
                </t:Item>
              </t:SetItemField>`,
    ];
    if (params.bodyHtml) {
      updates.push(`<t:SetItemField>
                <t:FieldURI FieldURI="item:Body"/>
                <t:Item>
                  <t:Body BodyType="HTML">${encodeXml(params.bodyHtml)}</t:Body>
                </t:Item>
              </t:SetItemField>`);
    }
    const updated = await ewsSoap({
      userEmail: params.userEmail,
      accessToken: params.accessToken,
      action: "UpdateItem",
      bodyXml: `<m:UpdateItem ConflictResolution="AlwaysOverwrite">
        <m:ItemChanges>
          <t:ItemChange>
            <t:ItemId Id="${encodeXml(existing.id)}"${existing.changeKey ? ` ChangeKey="${encodeXml(existing.changeKey)}"` : ""}/>
            <t:Updates>
              ${updates.join("\n")}
            </t:Updates>
          </t:ItemChange>
        </m:ItemChanges>
      </m:UpdateItem>`,
    });
    if (updated.ok) return updated;
  }

  const attempts: Array<{
    wrapper: "Item" | "Message" | "PostItem";
    messageDisposition?: boolean;
    itemClass: string;
    associated?: boolean;
  }> = [
    { wrapper: "Item", itemClass: params.itemClass },
    { wrapper: "Message", messageDisposition: true, itemClass: params.itemClass },
    { wrapper: "PostItem", itemClass: params.itemClass },
    { wrapper: "Item", itemClass: "IPM.Note" },
    { wrapper: "Item", itemClass: params.itemClass, associated: true },
  ];

  let last: EwsResult | null = null;
  for (const attempt of attempts) {
    const created = await createFolderItem({
      userEmail: params.userEmail,
      accessToken: params.accessToken,
      folder: params.folder,
      wrapper: attempt.wrapper,
      messageDisposition: attempt.messageDisposition,
      itemClass: attempt.itemClass,
      subject: params.subject,
      rawJson: params.rawJson,
      bodyHtml: params.bodyHtml,
      associated: attempt.associated,
    });
    if (!created.ok) {
      last = created;
      continue;
    }
    if (attempt.itemClass !== params.itemClass) {
      const id = parseItemId(created.xml);
      if (id) {
        const relabeled = await updateItemClass({
          userEmail: params.userEmail,
          accessToken: params.accessToken,
          item: id,
          itemClass: params.itemClass,
        });
        if (!relabeled.ok) {
          last = relabeled;
          continue;
        }
      }
    }
    return created;
  }

  return last ?? { ok: false, xml: "", error: `EWS CreateItem failed for ${params.subject}` };
}
