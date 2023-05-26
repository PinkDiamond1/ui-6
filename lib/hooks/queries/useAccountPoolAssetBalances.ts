import { useQuery } from "@tanstack/react-query";
import {
  Context,
  isIndexedData,
  isRpcSdk,
  parseAssetId,
  Pool,
} from "@zeitgeistpm/sdk-next";
import { getApiAtBlock } from "lib/util/get-api-at";
import { useSdkv2 } from "../useSdkv2";
import { FullPoolFragment } from "@zeitgeistpm/indexer";

export const accountPoolAssetBalancesRootKey = "account-pool-asset-balances";

export const useAccountPoolAssetBalances = (
  address?: string,
  pool?: Pool<Context> | FullPoolFragment,
  blockNumber?: number,
) => {
  const [sdk, id] = useSdkv2();

  const query = useQuery(
    [id, accountPoolAssetBalancesRootKey, address, pool?.poolId, blockNumber],
    async () => {
      if (isRpcSdk(sdk) && pool) {
        const assets = isIndexedData(pool)
          ? pool.weights
              .filter((weight) => weight?.assetId !== "Ztg")
              .map((weight) =>
                weight?.assetId
                  ? parseAssetId(weight?.assetId).unrightOr(undefined)
                  : undefined,
              )
          : pool.assets;

        const api = await getApiAtBlock(sdk.api, blockNumber);

        const balances = await api.query.tokens.accounts.multi(
          assets.map((assets) => [address, assets]),
        );

        return balances;
      }
    },
    {
      enabled: Boolean(sdk && isRpcSdk(sdk) && address && pool),
      initialData: [],
    },
  );

  return query;
};
