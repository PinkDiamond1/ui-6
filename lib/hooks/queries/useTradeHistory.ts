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
import { HistoricalSwapOrderByInput } from "@zeitgeistpm/indexer";

export const transactionHistoryKey = "trade-history";

const marketHeaderQuery = gql`
  query MarketTransactionHeader($marketIds: [Int!]) {
    markets(
      where: {
        marketId_in: $marketIds
        isMetaComplete_eq: true
        question_isNull: false
        question_not_eq: ""
      }
      orderBy: marketId_ASC
    ) {
      marketId
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
    const market = marketsMap.get(marketId);
    return market && market.categories[index].name;
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
    const market = marketsMap.get(marketId);
    return market && { question: market.question, marketId: marketId };
  } else {
    return;
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
  marketId: number;
  question: string;
  categories: { name: string }[];
};

export const useTradeHistory = (address: string) => {
  const [sdk, id] = useSdkv2();

  const query = useQuery(
    [id, transactionHistoryKey, address],
    async () => {
      if (isIndexedSdk(sdk) && isRpcSdk(sdk) && address) {
        const { historicalSwaps } = await sdk.indexer.historicalSwaps({
          where: {
            accountId_eq: address,
          },
          order: HistoricalSwapOrderByInput.BlockNumberDesc,
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
        marketIdsArray.forEach((marketId) => {
          const market = markets.find((m) => m.marketId === marketId);
          if (market) {
            marketsMap.set(marketId, market);
          }
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

        const trades = historicalSwaps
          .map((swap) => {
            const market =
              lookupMarket(swap.assetIn, marketsMap) ??
              lookupMarket(swap.assetOut, marketsMap);

            if (!market) {
              return;
            }

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
          })
          .filter((trade) => trade != null);

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
