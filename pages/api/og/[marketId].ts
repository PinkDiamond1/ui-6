import { create } from "@zeitgeistpm/indexer";
import type { FullMarketFragment, PoolWhereInput } from "@zeitgeistpm/indexer";
import Decimal from "decimal.js";
import { graphQlEndpoint, ZTG } from "lib/constants";
import { getCurrentPrediction } from "lib/util/assets";
import moment from "moment";
import type { NextApiRequest, NextApiResponse } from "next";

const sdkPromise = create({
  uri: graphQlEndpoint,
});

export type MarketImageData = {
  market: FullMarketFragment;
  prediction: ReturnType<typeof getCurrentPrediction>;
  volume: string;
  ends: string;
};

export default async function (
  request: NextApiRequest,
  response: NextApiResponse,
) {
  const sdk = await sdkPromise;
  const { marketId } = request.query;

  const { markets } = await sdk.markets({
    where: {
      marketId_eq: Number(marketId),
    },
  });

  const market = markets[0];

  if (!market) {
    return response
      .status(404)
      .json({ error: `No market found by id ${marketId}` });
  }

  let prediction: { name: string; price: number; percentage: number } = {
    name: null,
    percentage: 0,
    price: 0,
  };

  if (market.pool) {
    const { assets } = await sdk.assets({
      where: {
        pool: { poolId_eq: market.pool.poolId },
      },
    });

    prediction = getCurrentPrediction(assets as any, market as any);
  }

  const volume = new Decimal(market.pool?.volume ?? 0).div(ZTG).toFixed(2);

  const ends = moment(Number(market.period.end)).format("MMM Do, YYYY");

  const data: MarketImageData = {
    market,
    prediction,
    volume,
    ends,
  };

  return response.status(200).json(data);
}
