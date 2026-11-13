/**
 * Open the primary Mission Explorer from the project root route.
 * @author Sultan
 */
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/explorer");
}
