/**
 * Person page: the 2D circle of the person from the views app above the static list of
 * mentions, which stays as the path for exact reading and without JavaScript.
 */
import { actorOf, bridge, loadRoutes, loadStore, mountView } from "./views.js";

export async function init(root) {
  const host = document.getElementById("figure");
  const [store, routes] = await Promise.all([loadStore(root), loadRoutes(root)]);
  bridge(root, routes);
  const actor = actorOf(store, host.dataset.actor);
  if (!actor) return;
  await mountView(root, host, store, "overview", actor);
}
