import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  mockMembers,
  mockRoles,
  mockMemberCategories,
  mockOrgLinks,
  mockBulletinCategories,
  mockCalendarCategories,
  mockDutyTypes,
  mockShiftTypes,
  type BulletinCategory,
  type CalendarCategory,
  type DutyType,
  type MemberCategory,
  type OrgLink,
  type Role,
  type ShiftType,
} from "@on-connect/shared";
import { orgApi, type AdminUser } from "../api/orgApi";

interface OrgDataContextValue {
  members: AdminUser[];
  roles: Role[];
  memberCategories: MemberCategory[];
  orgLinks: OrgLink[];
  bulletinCategories: BulletinCategory[];
  calendarCategories: CalendarCategory[];
  dutyTypes: DutyType[];
  shiftTypes: ShiftType[];
  isLoading: boolean;
  refetchMembers: () => Promise<void>;
}

const OrgDataContext = createContext<OrgDataContextValue | undefined>(undefined);

/**
 * 組織の「軽量な参照リスト」をアプリ起動時にまとめて取得し全画面に配る（Phase 8b/8c）。
 * 未接続（EXPO_PUBLIC_API_URL未設定）・取得失敗時はダミーデータにフォールバックする。
 * mobileには管理画面が無いため全て読み取り専用（refetchMembersのみ公開、他は起動時取得のみで十分）。
 * BulletinPosts/CalendarEvents/MemberDailyStatus/DailyNoteのような「本体データ」はここに含めない。
 */
export function OrgDataProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<AdminUser[]>(mockMembers);
  const [roles, setRoles] = useState<Role[]>(mockRoles);
  const [memberCategories, setMemberCategories] = useState<MemberCategory[]>(mockMemberCategories);
  const [orgLinks, setOrgLinks] = useState<OrgLink[]>(mockOrgLinks);
  const [bulletinCategories, setBulletinCategories] = useState<BulletinCategory[]>(mockBulletinCategories);
  const [calendarCategories, setCalendarCategories] = useState<CalendarCategory[]>(mockCalendarCategories);
  const [dutyTypes, setDutyTypes] = useState<DutyType[]>(mockDutyTypes);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>(mockShiftTypes);
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
        orgApi
          .listOrgLinks()
          .then(setOrgLinks)
          .catch(() => setOrgLinks(mockOrgLinks)),
        orgApi
          .listBulletinCategories()
          .then(setBulletinCategories)
          .catch(() => setBulletinCategories(mockBulletinCategories)),
        orgApi
          .listCalendarCategories()
          .then(setCalendarCategories)
          .catch(() => setCalendarCategories(mockCalendarCategories)),
        orgApi
          .listDutyTypes()
          .then(setDutyTypes)
          .catch(() => setDutyTypes(mockDutyTypes)),
        orgApi
          .listShiftTypes()
          .then(setShiftTypes)
          .catch(() => setShiftTypes(mockShiftTypes)),
      ]);
      setIsLoading(false);
    })();
  }, [refetchMembers]);

  return (
    <OrgDataContext.Provider
      value={{
        members,
        roles,
        memberCategories,
        orgLinks,
        bulletinCategories,
        calendarCategories,
        dutyTypes,
        shiftTypes,
        isLoading,
        refetchMembers,
      }}
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
