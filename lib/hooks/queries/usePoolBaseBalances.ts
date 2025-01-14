import { useQueries } from "@tanstack/react-query";
import {
  Context,
  IOZtgAssetId,
  isRpcSdk,
  parseAssetId,
  PoolList,
} from "@zeitgeistpm/sdk-next";
import Decimal from "decimal.js";
import { getApiAtBlock } from "lib/util/get-api-at";
import { useSdkv2 } from "../useSdkv2";
import { usePoolAccountIds } from "./usePoolAccountIds";

export const rootKey = "pool-ztg-balance";

/**
 * Account balance index for pr pool.
 */
export type PoolZtgBalanceLookup = {
  [poolId: number]: Decimal;
};

/**
 * Fetch pool ZTG balances for a list of pools.
 */
export const usePoolBaseBalances = (
  pools?: PoolList<Context>,
  blockNumber?: number,
  opts?: {
    enabled?: boolean;
  },
): { data: PoolZtgBalanceLookup; isLoading: boolean } => {
  const [sdk, id] = useSdkv2();

  const poolAccountIds = usePoolAccountIds(pools);

  const query = useQueries({
    queries:
      pools?.map((pool) => {
        const accountId = poolAccountIds[pool.poolId];
        return {
          queryKey: [id, rootKey, pool.poolId, blockNumber],
          queryFn: async () => {
            if (sdk && isRpcSdk(sdk) && pools && accountId) {
              const api = await getApiAtBlock(sdk.api, blockNumber);
              const baseAssetId = parseAssetId(pool?.baseAsset).unrightOr(null);

              if (IOZtgAssetId.is(baseAssetId)) {
                const balance = await api.query.system.account(accountId);

                return {
                  pool,
                  balance: new Decimal(balance.data.free.toString()),
                };
              } else if (baseAssetId) {
                const balance = await api.query.tokens.accounts(
                  accountId,
                  baseAssetId,
                );

                return {
                  pool,
                  balance: new Decimal(balance.free.toString()),
                };
              }
            }
            return null;
          },
          keepPreviousData: true,
          enabled:
            Boolean(sdk) &&
            isRpcSdk(sdk) &&
            Boolean(accountId) &&
            (typeof opts?.enabled === "undefined" ? true : opts?.enabled),
        };
      }) ?? [],
  });

  const data = query.reduce<PoolZtgBalanceLookup>((index, query) => {
    if (!query.data) return index;
    return {
      ...index,
      [query.data.pool.poolId]: query.data.balance,
    };
  }, {});

  return {
    data,
    isLoading: query.some((q) => q.isLoading),
  };
};
