import type { AzureTenantConfig } from "@/types";
import { getGraphClient, isGraphConfigured } from "./client";

export type DirectoryGroup = {
  id: string;
  displayName: string;
  mail: string | null;
};

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isGroupId(value: string | null | undefined): boolean {
  return Boolean(value && GUID.test(value));
}

export async function listDirectoryGroups(
  tenantConfig: AzureTenantConfig,
  query?: string
): Promise<DirectoryGroup[]> {
  const client = await getGraphClient(tenantConfig);
  const q = query?.trim();

  const collect = async (startUrl: string, useSearch: boolean, max = 200) => {
    const groups: DirectoryGroup[] = [];
    let url: string | null = startUrl;
    while (url && groups.length < max) {
      const request = client.api(url);
      if (useSearch) request.header("ConsistencyLevel", "eventual");
      const page = await request.get();
      for (const group of page.value ?? []) {
        if (!group?.id || !group.displayName) continue;
        groups.push({
          id: group.id,
          displayName: group.displayName,
          mail: group.mail ?? null,
        });
      }
      const nextLink: string | undefined = page["@odata.nextLink"];
      url = nextLink ? nextLink.replace("https://graph.microsoft.com/v1.0", "") : null;
    }
    return groups;
  };

  if (q) {
    const escaped = q.replace(/"/g, "");
    try {
      return await collect(
        `/groups?$select=id,displayName,mail&$top=50&$search="displayName:${escaped}"`,
        true,
        50
      );
    } catch {
      const all = await collect(`/groups?$select=id,displayName,mail&$top=999`, false);
      const lower = q.toLowerCase();
      return all.filter((group) => group.displayName.toLowerCase().includes(lower)).slice(0, 50);
    }
  }

  return collect(`/groups?$select=id,displayName,mail&$top=999`, false);
}

export async function getDirectoryGroupsByIds(
  tenantConfig: AzureTenantConfig,
  ids: string[]
): Promise<DirectoryGroup[]> {
  const unique = [...new Set(ids.filter(isGroupId))];
  if (unique.length === 0) return [];
  const client = await getGraphClient(tenantConfig);
  const results: DirectoryGroup[] = [];
  for (const id of unique) {
    try {
      const group = await client.api(`/groups/${id}`).select("id,displayName,mail").get();
      if (group?.id) {
        results.push({
          id: group.id,
          displayName: group.displayName || group.id,
          mail: group.mail ?? null,
        });
      }
    } catch {
      /* skip missing groups */
    }
  }
  return results;
}

export async function listGroupMemberIds(
  tenantConfig: AzureTenantConfig,
  groupId: string
): Promise<string[]> {
  const client = await getGraphClient(tenantConfig);
  const urls = [
    `/groups/${groupId}/transitiveMembers/microsoft.graph.user?$select=id&$top=999`,
    `/groups/${groupId}/members?$select=id&$top=999`,
  ];

  for (const startUrl of urls) {
    try {
      const ids: string[] = [];
      let url: string | null = startUrl;
      while (url) {
        const page = await client.api(url).get();
        for (const member of page.value ?? []) {
          if (member?.id) ids.push(member.id);
        }
        const nextLink: string | undefined = page["@odata.nextLink"];
        url = nextLink ? nextLink.replace("https://graph.microsoft.com/v1.0", "") : null;
      }
      return ids;
    } catch {
      /* try the next endpoint */
    }
  }

  return [];
}

export async function loadGroupMemberMap(
  tenantConfig: AzureTenantConfig | null | undefined,
  targets: Array<{ targetType: string | null; targetValue: string | null }>
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  if (!tenantConfig || !isGraphConfigured(tenantConfig)) return map;
  const groupIds = [
    ...new Set(
      targets
        .filter((target) => target.targetType === "group" && isGroupId(target.targetValue))
        .map((target) => target.targetValue as string)
    ),
  ];
  await Promise.all(
    groupIds.map(async (id) => {
      try {
        map.set(id, new Set(await listGroupMemberIds(tenantConfig, id)));
      } catch {
        map.set(id, new Set());
      }
    })
  );
  return map;
}
