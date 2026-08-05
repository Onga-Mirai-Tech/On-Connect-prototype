import { NavigationContainer, type NavigatorScreenParams } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

import { LoginScreen } from "../screens/LoginScreen";
import { ChatListScreen } from "../screens/ChatListScreen";
import { ChatRoomScreen } from "../screens/ChatRoomScreen";
import { NewDirectMessageScreen } from "../screens/NewDirectMessageScreen";
import { GroupChatCreateScreen } from "../screens/GroupChatCreateScreen";
import { MembersScreen } from "../screens/MembersScreen";
import { IncomingCallScreen } from "../screens/IncomingCallScreen";
import { BulletinScreen } from "../screens/BulletinScreen";
import { BulletinDetailScreen } from "../screens/BulletinDetailScreen";
import { BulletinEditScreen } from "../screens/BulletinEditScreen";
import { CalendarScreen } from "../screens/CalendarScreen";
import { CalendarEventEditScreen } from "../screens/CalendarEventEditScreen";
import { CalendarDetailScreen } from "../screens/CalendarDetailScreen";
import { LinksScreen } from "../screens/LinksScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { HeaderStatus } from "./HeaderStatus";
import { colors } from "../theme/colors";

export type ChatStackParamList = {
  ChatList: undefined;
  ChatRoom: { roomId: string };
  NewDirectMessage: undefined;
  GroupChatCreate: undefined;
};

export type BulletinStackParamList = {
  BulletinList: undefined;
  BulletinDetail: { postId: string };
  BulletinEdit: { postId?: string };
};

export type CalendarStackParamList = {
  CalendarList: undefined;
  CalendarDetail: { eventId: string };
  CalendarEventEdit: { eventId?: string };
};

// 管理者機能はブラウザ版（apps/web）のみで提供し、モバイル版にはタブを設けない。
export type HomeTabParamList = {
  ChatTab: NavigatorScreenParams<ChatStackParamList> | undefined;
  Members: undefined;
  BulletinTab: NavigatorScreenParams<BulletinStackParamList> | undefined;
  Calendar: NavigatorScreenParams<CalendarStackParamList> | undefined;
  Links: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Home: NavigatorScreenParams<HomeTabParamList> | undefined;
  IncomingCall: { callerName: string };
};

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const tabIcons: Record<keyof HomeTabParamList, IoniconName> = {
  ChatTab: "chatbubbles-outline",
  Members: "people-outline",
  BulletinTab: "clipboard-outline",
  Calendar: "calendar-outline",
  Links: "link-outline",
  Settings: "settings-outline",
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const HomeTab = createBottomTabNavigator<HomeTabParamList>();
const ChatStack = createNativeStackNavigator<ChatStackParamList>();
const BulletinStack = createNativeStackNavigator<BulletinStackParamList>();
const CalendarStack = createNativeStackNavigator<CalendarStackParamList>();

function ChatStackNavigator() {
  return (
    <ChatStack.Navigator>
      <ChatStack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{ title: "チャット", headerLeft: () => <HeaderStatus /> }}
      />
      <ChatStack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ title: "" }} />
      <ChatStack.Screen
        name="NewDirectMessage"
        component={NewDirectMessageScreen}
        options={{ title: "個別メッセージ" }}
      />
      <ChatStack.Screen
        name="GroupChatCreate"
        component={GroupChatCreateScreen}
        options={{ title: "グループ作成" }}
      />
    </ChatStack.Navigator>
  );
}

function BulletinStackNavigator() {
  return (
    <BulletinStack.Navigator>
      <BulletinStack.Screen
        name="BulletinList"
        component={BulletinScreen}
        options={{ title: "掲示板", headerLeft: () => <HeaderStatus /> }}
      />
      <BulletinStack.Screen name="BulletinDetail" component={BulletinDetailScreen} options={{ title: "" }} />
      <BulletinStack.Screen name="BulletinEdit" component={BulletinEditScreen} options={{ title: "投稿" }} />
    </BulletinStack.Navigator>
  );
}

function CalendarStackNavigator() {
  return (
    <CalendarStack.Navigator>
      <CalendarStack.Screen
        name="CalendarList"
        component={CalendarScreen}
        options={{ title: "カレンダー", headerLeft: () => <HeaderStatus /> }}
      />
      <CalendarStack.Screen name="CalendarDetail" component={CalendarDetailScreen} options={{ title: "" }} />
      <CalendarStack.Screen
        name="CalendarEventEdit"
        component={CalendarEventEditScreen}
        options={{ title: "予定" }}
      />
    </CalendarStack.Navigator>
  );
}

/** ホーム画面（7章 2番）：チャット／メンバー／掲示板／カレンダー／リンク集のタブ構成 + 設定 */
function HomeTabs() {
  return (
    <HomeTab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.brandDark,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={tabIcons[route.name]} color={color} size={size} />
        ),
        headerLeft: () => <HeaderStatus />,
      })}
    >
      <HomeTab.Screen name="ChatTab" component={ChatStackNavigator} options={{ title: "チャット", headerShown: false }} />
      <HomeTab.Screen name="Members" component={MembersScreen} options={{ title: "メンバー" }} />
      <HomeTab.Screen name="BulletinTab" component={BulletinStackNavigator} options={{ title: "掲示板", headerShown: false }} />
      <HomeTab.Screen name="Calendar" component={CalendarStackNavigator} options={{ title: "カレンダー", headerShown: false }} />
      <HomeTab.Screen name="Links" component={LinksScreen} options={{ title: "リンク集" }} />
      <HomeTab.Screen name="Settings" component={SettingsScreen} options={{ title: "設定" }} />
    </HomeTab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Login" component={LoginScreen} />
        <RootStack.Screen name="Home" component={HomeTabs} />
        <RootStack.Screen
          name="IncomingCall"
          component={IncomingCallScreen}
          options={{ presentation: "fullScreenModal" }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
