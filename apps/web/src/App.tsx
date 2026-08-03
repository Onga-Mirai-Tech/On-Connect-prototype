import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { NotificationStatusProvider } from "./context/NotificationStatusContext";

export default function App() {
  return (
    <NotificationStatusProvider>
      <RouterProvider router={router} />
    </NotificationStatusProvider>
  );
}
