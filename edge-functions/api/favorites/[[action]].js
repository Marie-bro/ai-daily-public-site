import { getStore } from "@edgeone/pages-blob";
import { handleFavorites } from "../../_lib/favorites-core.js";

export async function onRequest(context) {
  const store = getStore({ name: "mariespace-favorites", consistency: "strong" });
  return handleFavorites(context, {
    store,
    fetcher: fetch,
    now: () => new Date(),
    config: {
      appId: context.env.FEISHU_APP_ID,
      appSecret: context.env.FEISHU_APP_SECRET,
      ownerId: context.env.OWNER_FEISHU_USER_ID,
      workerToken: context.env.MARIESPACE_WORKER_PULL_TOKEN,
    },
  });
}
