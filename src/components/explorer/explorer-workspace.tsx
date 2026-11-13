/**
 * Give the lunar map the complete workspace; context opens from map interactions.
 * @author Sultan
 */
import { LunarMap } from "@/components/explorer/lunar-map";

export function ExplorerWorkspace() {
  return (
    <div className="mission-workspace">
      <h1 className="sr-only">Mission Explorer</h1>
      <LunarMap />
    </div>
  );
}
