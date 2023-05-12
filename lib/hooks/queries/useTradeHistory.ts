import { useQuery } from "@tanstack/react-query";
import {
  getIndexOf,
  getMarketIdOf,
  IOBaseAssetId,
  IOForeignAssetId,
  IOMarketOutcomeAssetId,
  isIndexedSdk,
  isRpcSdk,
  parseAssetId,
} from "@zeitgeistpm/sdk-next";
import Decimal from "decimal.js";
import { gql } from "graphql-request";
import { useSdkv2 } from "../useSdkv2";

export const transactionHistoryKey = "trade-history";

const tradeHistoryQuery = gql`
  query TradeHistory($address: String) {
    historicalSwaps(
      where: { accountId_eq: $address }
      orderBy: blockNumber_DESC
    ) {
      assetAmountIn
      assetAmountOut
      assetIn
      assetOut
      timestamp
    }
  }
`;

const marketHeaderQuery = gql`
  query MarketTransactionHeader($marketIds: [Int!]) {
    markets(where: { marketId_in: $marketIds }, orderBy: marketId_ASC) {
      question
      categories {
        name
      }
    }
  }
`;

const lookupAssetName = (
  asset: string,
  marketsMap: Map<number, MarketHeader>,
  foreignAssetMap: Map<number, string>,
) => {
  const assetId = parseAssetId(asset).unwrap();

  if (IOMarketOutcomeAssetId.is(assetId)) {
    const marketId = getMarketIdOf(assetId);
    const index = getIndexOf(assetId);
    return marketsMap.get(marketId).categories[index].name;
  } else if (IOForeignAssetId.is(assetId)) {
    return foreignAssetMap.get(assetId.ForeignAsset);
  } else {
    return asset.toUpperCase();
  }
};

const lookupMarket = (asset: string, marketsMap: Map<number, MarketHeader>) => {
  const assetId = parseAssetId(asset).unwrap();

  if (IOMarketOutcomeAssetId.is(assetId)) {
    const marketId = getMarketIdOf(assetId);
    return { question: marketsMap.get(marketId).question, marketId: marketId };
  } else {
    return null;
  }
};

const calculatePrice = (
  assetIn: string,
  assetOut: string,
  assetAmountIn: string,
  assetAmountOut: string,
) => {
  const assetInId = parseAssetId(assetIn).unwrap();

  const assetInIsBaseAsset = IOBaseAssetId.is(assetInId);

  if (assetInIsBaseAsset) {
    return {
      price: new Decimal(assetAmountIn).div(assetAmountOut),
      baseAsset: assetIn,
    };
  } else {
    return {
      price: new Decimal(assetAmountOut).div(assetAmountIn),
      baseAsset: assetOut,
    };
  }
};

type MarketHeader = {
  question: string;
  categories: { name: string }[];
};

export const useTradeHistory = (address: string) => {
  const [sdk, id] = useSdkv2();

  const query = useQuery(
    [id, transactionHistoryKey, address],
    async () => {
      if (isIndexedSdk(sdk) && isRpcSdk(sdk) && address) {
        const { historicalSwaps } = await sdk.indexer.client.request<{
          historicalSwaps: {
            assetAmountIn: string;
            assetAmountOut: string;
            assetIn: string;
            assetOut: string;
            timestamp: string;
          }[];
        }>(tradeHistoryQuery, {
          address: address,
        });

        const foreignAssetIds = new Set<number>();
        const marketIds = new Set<number>(
          historicalSwaps.map((swap) => {
            const assetInId = parseAssetId(swap.assetIn).unwrap();
            const assetOutId = parseAssetId(swap.assetOut).unwrap();

            if (IOForeignAssetId.is(assetInId)) {
              foreignAssetIds.add(assetInId.ForeignAsset);
            } else if (IOForeignAssetId.is(assetOutId)) {
              foreignAssetIds.add(assetOutId.ForeignAsset);
            }

            if (IOMarketOutcomeAssetId.is(assetInId)) {
              return getMarketIdOf(assetInId);
            } else if (IOMarketOutcomeAssetId.is(assetOutId)) {
              return getMarketIdOf(assetOutId);
            }
          }),
        );

        const marketIdsArray = Array.from(marketIds).sort((a, b) => a - b);

        const { markets } = await sdk.indexer.client.request<{
          markets: MarketHeader[];
        }>(marketHeaderQuery, {
          marketIds: marketIdsArray,
        });

        const marketsMap: Map<number, MarketHeader> = new Map();
        marketIdsArray.forEach((marketId, index) => {
          marketsMap.set(marketId, markets[index]);
        });

        const foreignAssetIdsArray = Array.from(foreignAssetIds);
        const assetMetadata = await Promise.all(
          foreignAssetIdsArray.map((assetId) =>
            sdk.api.query.assetRegistry.metadata({ ForeignAsset: assetId }),
          ),
        );

        const metadataMap: Map<number, string> = new Map();
        assetMetadata.forEach((asset, index) => {
          const symbol = asset.unwrap().symbol.toPrimitive() as string;
          metadataMap.set(foreignAssetIdsArray[index], symbol);
        });

        const trades = historicalSwaps.map((swap) => {
          const market =
            lookupMarket(swap.assetIn, marketsMap) ??
            lookupMarket(swap.assetOut, marketsMap);

          const priceInfo = calculatePrice(
            swap.assetIn,
            swap.assetOut,
            swap.assetAmountIn,
            swap.assetAmountOut,
          );

          return {
            marketId: market?.marketId,
            question: market?.question,
            assetIn: lookupAssetName(swap.assetIn, marketsMap, metadataMap),
            assetOut: lookupAssetName(swap.assetOut, marketsMap, metadataMap),
            assetAmountIn: new Decimal(swap.assetAmountIn),
            assetAmountOut: new Decimal(swap.assetAmountOut),
            price: priceInfo.price,
            baseAssetName: lookupAssetName(
              priceInfo.baseAsset,
              marketsMap,
              metadataMap,
            ),
            time: swap.timestamp,
          };
        });

        return trades;
      }
    },
    {
      keepPreviousData: true,
      enabled: Boolean(sdk && isIndexedSdk(sdk) && isRpcSdk(sdk) && address),
    },
  );

  return query;
};
