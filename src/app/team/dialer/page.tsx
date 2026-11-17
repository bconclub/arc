import { redirect } from "next/navigation";

/** The dialer lives on its own screen. Setup and logs: /team/dialer/setup. */
export default function TeamDialer() {
  redirect("/dialer");
}
