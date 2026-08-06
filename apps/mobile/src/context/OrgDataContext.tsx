import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { mockMembers, mockRoles, mockMemberCategories, type MemberCategory, type Role } from "@on-connect/shared";
import { orgApi, type AdminUser } from "../api/orgApi";

interface OrgDataContextValue {
  members: AdminUser[];
  roles: Role[];
  memberCategories: MemberCategory[];
  isLoading: boolean;
  refetchMembers: () => Promise<void>;
}

const OrgDataContext = createContext<OrgDataContextValue | undefined>(undefined);

/**
 * Users/Roles/MemberCategoriesをアプリ起動時にまとめて取得し全画面に配る（Phase 8b）。
 * 未接続（EXPO_PUBLIC_API_URL未設定）・取得失敗時はダミーデータにフォールバックする（Phase 8aと同じ方針）。
 * mobileには管理画面が無いため読み取り専用（refetchMembersのみ公開、他は起動時取得のみで十分）。
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

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await Promise.all([
        refetchMembers(),
        orgApi
          .listRoles()
          .then(setRoles)
          .catch(() => setRoles(mockRoles)),
        orgApi
          .listMemberCategories()
          .then(setMemberCategories)
          .catch(() => setMemberCategories(mockMemberCategories)),
      ]);
      setIsLoading(false);
    })();
  }, [refetchMembers]);

  return (
    <OrgDataContext.Provider value={{ members, roles, memberCategories, isLoading, refetchMembers }}>
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
