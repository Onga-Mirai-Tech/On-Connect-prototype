import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { mockMembers, mockRoles, mockMemberCategories, type MemberCategory, type Role } from "@on-connect/shared";
import { orgApi, type AdminUser } from "../api/orgApi";

interface OrgDataContextValue {
  members: AdminUser[];
  roles: Role[];
  memberCategories: MemberCategory[];
  isLoading: boolean;
  refetchMembers: () => Promise<void>;
  refetchRoles: () => Promise<void>;
  refetchMemberCategories: () => Promise<void>;
}

const OrgDataContext = createContext<OrgDataContextValue | undefined>(undefined);

/**
 * Users/Roles/MemberCategoriesをアプリ起動時にまとめて取得し全画面に配る（Phase 8b）。
 * 未接続（VITE_API_URL未設定）・取得失敗時はダミーデータにフォールバックする（Phase 8aと同じ方針）。
 * 「自分は誰か」の早期解決はAuthContext.fetchOwnProfileが別途担うため、ここでは統合しない。
 */
export function OrgDataProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<AdminUser[]>(mockMembers);
  const [roles, setRoles] = useState<Role[]>(mockRoles);
  const [memberCategories, setMemberCategories] = useState<MemberCategory[]>(mockMemberCategories);
  const [isLoading, setIsLoading] = useState(true);

  const refetchMembers = useCallback(async () => {
    try {
      setMembers(await orgApi.listUsers());
    } catch {
      setMembers(mockMembers);
    }
  }, []);

  const refetchRoles = useCallback(async () => {
    try {
      setRoles(await orgApi.listRoles());
    } catch {
      setRoles(mockRoles);
    }
  }, []);

  const refetchMemberCategories = useCallback(async () => {
    try {
      setMemberCategories(await orgApi.listMemberCategories());
    } catch {
      setMemberCategories(mockMemberCategories);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await Promise.all([refetchMembers(), refetchRoles(), refetchMemberCategories()]);
      setIsLoading(false);
    })();
  }, [refetchMembers, refetchRoles, refetchMemberCategories]);

  return (
    <OrgDataContext.Provider
      value={{ members, roles, memberCategories, isLoading, refetchMembers, refetchRoles, refetchMemberCategories }}
    >
      {children}
    </OrgDataContext.Provider>
  );
}

export function useOrgData() {
  const ctx = useContext(OrgDataContext);
  if (!ctx) {
    throw new Error("useOrgData must be used within OrgDataProvider");
  }
  return ctx;
}
