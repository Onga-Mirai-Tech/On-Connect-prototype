// npm workspacesモノレポでは`expo`がワークスペースルートにホイストされるため、
// `expo/AppEntry.js`の`import App from '../../App'`（自身のファイル位置基準の相対パス）が
// ホイスト先を基準に解決されてしまい、apps/mobile/App.tsxに辿り着けない。
// 公式のモノレポ対応どおり、ここで明示的にApp.tsxを登録することで回避する。
import { registerRootComponent } from "expo";

import App from "./App";

registerRootComponent(App);
