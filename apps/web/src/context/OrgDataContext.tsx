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
  mapWithConcurrency,
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
  refetchRoles: () => Promise<void>;
  refetchMemberCategories: () => Promise<void>;
  refetchOrgLinks: () => Promise<void>;
  refetchBulletinCategories: () => Promise<void>;
  refetchCalendarCategories: () => Promise<void>;
  refetchDutyTypes: () => Promise<void>;
  refetchShiftTypes: () => Promise<void>;
}

const OrgDataContext = createContext<OrgDataContextValue | undefined>(undefined);

/**
 * 組織の「軽量な参照リスト」（Users/Roles/MemberCategories/OrgLinks/BulletinCategories/
 * CalendarCategories/DutyTypes/ShiftTypes）をアプリ起動時にまとめて取得し全画面に配る（Phase 8b/8c）。
 * 未接続（VITE_API_URL未設定）・取得失敗時はダミーデータにフォールバックする。
 * BulletinPosts/CalendarEvents/MemberDailyStatus/DailyNoteのような「本体データ」はここに含めず、
 * 各ページが自分で取得する（一覧規模・絞り込み条件がページごとに異なるため）。
 * 「自分は誰か」の早期解決はAuthContext.fetchOwnProfileが別途担うため、ここでは統合しない。
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

  const refetchOrgLinks = useCallback(async () => {
    try {
      setOrgLinks(await orgApi.listOrgLinks());
    } catch {
      setOrgLinks(mockOrgLinks);
    }
  }, []);

  const refetchBulletinCategories = useCallback(async () => {
    try {
      setBulletinCategories(await orgApi.listBulletinCategories());
    } catch {
      setBulletinCategories(mockBulletinCategories);
    }
  }, []);

  const refetchCalendarCategories = useCallback(async () => {
    try {
      setCalendarCategories(await orgApi.listCalendarCategories());
    } catch {
      setCalendarCategories(mockCalendarCategories);
    }
  }, []);

  const refetchDutyTypes = useCallback(async () => {
    try {
      setDutyTypes(await orgApi.listDutyTypes());
    } catch {
      setDutyTypes(mockDutyTypes);
    }
  }, []);

  const refetchShiftTypes = useCallback(async () => {
    try {
      setShiftTypes(await orgApi.listShiftTypes());
    } catch {
      setShiftTypes(mockShiftTypes);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      // 8件を一斉にPromise.allで投げるとAWSアカウントのLambda同時実行数上限に達し
      // 500エラーになることがあるため、同時実行数を制限する（他ページの並列fetchとも合算されるため控えめに）
      await mapWithConcurrency(
        [
          refetchMembers,
          refetchRoles,
          refetchMemberCategories,
          refetchOrgLinks,
          refetchBulletinCategories,
          refetchCalendarCategories,
          refetchDutyTypes,
          refetchShiftTypes,
        ],
        4,
        (refetch) => refetch(),
      );
      setIsLoading(false);
    })();
  }, [
    refetchMembers,
    refetchRoles,
    refetchMemberCategories,
    refetchOrgLinks,
    refetchBulletinCategories,
    refetchCalendarCategories,
    refetchDutyTypes,
    refetchShiftTypes,
  ]);

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
        refetchRoles,
        refetchMemberCategories,
        refetchOrgLinks,
        refetchBulletinCategories,
        refetchCalendarCategories,
        refetchDutyTypes,
        refetchShiftTypes,
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
